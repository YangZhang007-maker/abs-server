import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { ProductService } from '../product/product.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { getSupabaseClient, getStorageBucket } from '../../config/supabase.config';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly productService: ProductService,
  ) {}

  async findAllByProduct(
    productId: string,
    userId: string,
    role: UserRole,
    scheduleEventId?: string,
  ): Promise<Document[]> {
    await this.productService.findOne(productId, userId, role);

    const where: any = { productId, isDeleted: false };
    if (scheduleEventId) {
      where.scheduleEventId = scheduleEventId;
    }

    return this.documentRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async search(
    query: string,
    userId: string,
    role: UserRole,
    productId?: string,
    productName?: string,
    page?: number,
    limit?: number,
  ) {
    const pageNum = page || 1;
    const pageSize = limit || 10;

    if (productId) {
      await this.productService.findOne(productId, userId, role);

      const qb = this.documentRepository
        .createQueryBuilder('d')
        .leftJoin('d.product', 'p')
        .addSelect(['p.name'])
        .where('d.product_id = :productId', { productId })
        .andWhere('d.is_deleted = false');

      if (query.trim()) {
        qb.andWhere('d.original_name ILIKE :q', { q: `%${query.trim()}%` });
      }

      const [docs, total] = await qb
        .orderBy('d.created_at', 'DESC')
        .skip((pageNum - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return {
        items: docs.map((d) => ({
          ...d,
          productName: (d as any).product?.name || '',
        })),
        total,
        page: pageNum,
        limit: pageSize,
      };
    }

    const accessibleIds = await this.productService.getAccessibleProductIds(userId, role);
    if (accessibleIds.length === 0) return { items: [], total: 0, page: pageNum, limit: pageSize };

    const qb = this.documentRepository
      .createQueryBuilder('d')
      .leftJoin('d.product', 'p')
      .addSelect(['p.name'])
      .where('d.product_id IN (:...ids)', { ids: accessibleIds })
      .andWhere('d.is_deleted = false');

    if (query.trim()) {
      qb.andWhere('d.original_name ILIKE :q', { q: `%${query.trim()}%` });
    }

    if (productName && productName.trim()) {
      qb.andWhere('p.name ILIKE :pn', { pn: `%${productName.trim()}%` });
    }

    const [docs, total] = await qb
      .orderBy('d.created_at', 'DESC')
      .skip((pageNum - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: docs.map((d) => ({
        ...d,
        productName: (d as any).product?.name || '',
      })),
      total,
      page: pageNum,
      limit: pageSize,
    };
  }

  async upload(
    productId: string,
    file: Express.Multer.File,
    userId: string,
    role: UserRole,
    scheduleEventId?: string,
  ): Promise<Document> {
    if (!file) throw new BadRequestException('请选择要上传的文件');

    const product = await this.productService.findOne(productId, userId, role);

    if (role !== UserRole.ROOT && product.creatorId !== userId) {
      throw new ForbiddenException('只有产品负责人或总负责人可以上传文档');
    }

    const supabase = getSupabaseClient();
    const bucket = getStorageBucket();
    const ext = file.originalname.split('.').pop() || '';
    const storagePath = `${productId}/${randomUUID()}.${ext}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`文件上传失败: ${error.message}`);
    }

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const doc = this.documentRepository.create({
      productId,
      fileName: storagePath,           // Supabase Storage path
      originalName,
      mimeType: file.mimetype,
      fileSize: file.size,
      scheduleEventId: scheduleEventId || null,
    });

    return this.documentRepository.save(doc);
  }

  /**
   * 返回 Supabase Storage 签名下载 URL（有效期 1 小时）
   */
  async getDownloadUrl(document: Document): Promise<string> {
    const supabase = getSupabaseClient();
    const bucket = getStorageBucket();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(document.fileName, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      throw new NotFoundException('文件不存在或已被删除');
    }

    return data.signedUrl;
  }

  async remove(productId: string, id: string, userId: string, role: UserRole): Promise<void> {
    const product = await this.productService.findOne(productId, userId, role);

    if (role !== UserRole.ROOT && product.creatorId !== userId) {
      throw new ForbiddenException('只有产品负责人或总负责人可以删除文档');
    }

    const doc = await this.documentRepository.findOne({
      where: { id, productId, isDeleted: false },
    });
    if (!doc) throw new NotFoundException('文档未找到');

    // Remove from Supabase Storage
    const supabase = getSupabaseClient();
    const bucket = getStorageBucket();
    await supabase.storage.from(bucket).remove([doc.fileName]);

    doc.isDeleted = true;
    await this.documentRepository.save(doc);
  }
}