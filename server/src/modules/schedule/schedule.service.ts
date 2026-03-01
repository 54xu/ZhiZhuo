/**
 * 排班服务
 * 排班CRUD + 轮牌算法
 */

import { PrismaClient } from '@prisma/client';
import { eventBus, Events } from '../../core/event-bus';

/** 将日期字符串或"今天"转为 UTC 午夜 Date，匹配 Prisma 读取 MySQL DATE 字段的格式 */
function toDateOnly(dateStr?: string): Date {
  if (dateStr) {
    // 带 Z 后缀 → UTC 午夜，与 Prisma 读取 DATE 字段返回的格式一致
    return new Date(dateStr + 'T00:00:00Z');
  }
  // "今天"：取本地日期部分，构造 UTC 午夜
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
}

export class ScheduleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 获取某日排班列表
   */
  async getDaySchedule(storeId: number, date: string) {
    const scheduleDate = toDateOnly(date);

    const schedules = await this.prisma.schedule.findMany({
      where: { storeId, scheduleDate },
      orderBy: { rotationOrder: 'asc' },
      include: {
        technician: {
          select: { id: true, name: true, employeeNo: true, phone: true, skills: true },
        },
      },
    });

    return schedules.map((s: typeof schedules[number]) => ({
      ...s,
      technician: {
        ...s.technician,
        skills: s.technician.skills ? JSON.parse(s.technician.skills) : [],
      },
    }));
  }

  /**
   * 批量设置排班（替换指定日期的所有排班）
   */
  async setDaySchedule(storeId: number, date: string, items: Array<{
    technicianId: number;
    shiftStart: string;
    shiftEnd: string;
    rotationOrder: number;
  }>) {
    const scheduleDate = toDateOnly(date);

    // 验证技师都属于该门店
    const techIds = items.map((i) => i.technicianId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: techIds }, storeId, role: 'technician', status: 'active' },
    });
    if (employees.length !== techIds.length) {
      throw new Error('部分技师不存在或不属于当前门店');
    }

    await this.prisma.$transaction(async (tx) => {
      // 删除当日所有排班
      await tx.schedule.deleteMany({
        where: { storeId, scheduleDate },
      });

      // 批量创建
      if (items.length > 0) {
        await tx.schedule.createMany({
          data: items.map((item) => ({
            storeId,
            technicianId: item.technicianId,
            scheduleDate,
            shiftStart: item.shiftStart,
            shiftEnd: item.shiftEnd,
            rotationOrder: item.rotationOrder,
            status: 'scheduled',
          })),
        });
      }
    });

    await eventBus.emit(Events.SCHEDULE_UPDATED, { storeId, date });

    return this.getDaySchedule(storeId, date);
  }

  /**
   * 更新单个排班状态
   */
  async updateScheduleStatus(storeId: number, scheduleId: number, status: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, storeId },
    });
    if (!schedule) throw new Error('排班记录不存在');

    return this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { status },
    });
  }

  /**
   * 轮牌算法 - 获取推荐技师列表
   */
  async getRotationList(storeId: number, serviceId?: number) {
    const today = toDateOnly();

    const schedules = await this.prisma.schedule.findMany({
      where: {
        storeId,
        scheduleDate: today,
        status: { not: 'leave' },
      },
      orderBy: { rotationOrder: 'asc' },
      include: {
        technician: {
          select: { id: true, name: true, employeeNo: true, skills: true },
        },
      },
    });

    // 查询每个技师当前是否在服务中（有进行中订单）
    const techIds = schedules.map((s: typeof schedules[number]) => s.technicianId);
    const busyItems = await this.prisma.orderItem.findMany({
      where: {
        technicianId: { in: techIds },
        order: { orderStatus: { in: ['pending', 'in_progress'] }, storeId },
      },
      select: { technicianId: true },
    });
    const busySet = new Set(busyItems.map((b: typeof busyItems[number]) => b.technicianId));

    let result = schedules.map((s: typeof schedules[number]) => {
      const skills: number[] = s.technician.skills ? JSON.parse(s.technician.skills) : [];
      return {
        technicianId: s.technician.id,
        name: s.technician.name,
        employeeNo: s.technician.employeeNo,
        rotationOrder: s.rotationOrder,
        shiftTime: `${s.shiftStart}-${s.shiftEnd}`,
        isBusy: busySet.has(s.technicianId),
        skills,
      };
    });

    // 按技能筛选
    if (serviceId) {
      result = result.filter((t: typeof result[number]) =>
        t.skills.length === 0 || t.skills.includes(serviceId),
      );
    }

    // 空闲优先，忙碌的排后面
    result.sort((a: typeof result[number], b: typeof result[number]) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      return a.rotationOrder - b.rotationOrder;
    });

    return result;
  }

  /**
   * 轮牌推进 - 技师完成服务后排到队尾
   */
  async advanceRotation(storeId: number, technicianId: number) {
    const today = toDateOnly();

    const schedules = await this.prisma.schedule.findMany({
      where: { storeId, scheduleDate: today, status: { not: 'leave' } },
      orderBy: { rotationOrder: 'asc' },
    });

    if (schedules.length === 0) return;

    const maxOrder = Math.max(...schedules.map((s: typeof schedules[number]) => s.rotationOrder));
    const current = schedules.find((s: typeof schedules[number]) => s.technicianId === technicianId);

    if (current) {
      await this.prisma.schedule.update({
        where: { id: current.id },
        data: { rotationOrder: maxOrder + 1 },
      });
    }
  }
}
