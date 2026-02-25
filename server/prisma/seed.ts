import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // --------------------------------------------------
  // Guard: skip if already seeded
  // --------------------------------------------------
  const existingStore = await prisma.store.findFirst({
    where: { name: '致卓足浴旗舰店' },
  });
  if (existingStore) {
    console.log('Seed data already exists (store "致卓足浴旗舰店" found). Skipping.');
    return;
  }

  console.log('Starting seed...');

  // ==========================================================
  // 1. Store
  // ==========================================================
  console.log('Creating store...');
  const store = await prisma.store.create({
    data: {
      name: '致卓足浴旗舰店',
      address: '深圳市南山区科技路100号',
      phone: '0755-12345678',
      businessHours: '10:00-02:00',
    },
  });
  const storeId = store.id;
  console.log(`  Store created: id=${storeId}`);

  // ==========================================================
  // 2. Employees
  // ==========================================================
  console.log('Creating employees...');
  const [zhangManager, liCashier, wangTech, zhaoTech, liuTech] =
    await prisma.$transaction([
      prisma.employee.create({
        data: {
          storeId,
          name: '张店长',
          employeeNo: 'E001',
          role: 'admin',
          phone: '13800000001',
        },
      }),
      prisma.employee.create({
        data: {
          storeId,
          name: '李收银',
          employeeNo: 'E002',
          role: 'cashier',
          phone: '13800000002',
        },
      }),
      prisma.employee.create({
        data: {
          storeId,
          name: '王师傅',
          employeeNo: 'E003',
          role: 'technician',
          phone: '13800000003',
          skills: '[1,2,3]',
        },
      }),
      prisma.employee.create({
        data: {
          storeId,
          name: '赵师傅',
          employeeNo: 'E004',
          role: 'technician',
          phone: '13800000004',
          skills: '[1,2,4]',
        },
      }),
      prisma.employee.create({
        data: {
          storeId,
          name: '刘师傅',
          employeeNo: 'E005',
          role: 'technician',
          phone: '13800000005',
          skills: '[2,3,5]',
        },
      }),
    ]);
  console.log(
    `  Employees created: ${[zhangManager, liCashier, wangTech, zhaoTech, liuTech]
      .map((e) => `${e.name}(id=${e.id})`)
      .join(', ')}`,
  );

  // ==========================================================
  // 3. Zones
  // ==========================================================
  console.log('Creating zones...');
  const [zoneA, zoneB, zoneC] = await prisma.$transaction([
    prisma.zone.create({
      data: { storeId, name: 'A区-大厅', sortOrder: 1 },
    }),
    prisma.zone.create({
      data: { storeId, name: 'B区-VIP', sortOrder: 2 },
    }),
    prisma.zone.create({
      data: { storeId, name: 'C区-包间', sortOrder: 3 },
    }),
  ]);
  console.log(
    `  Zones created: ${[zoneA, zoneB, zoneC]
      .map((z) => `${z.name}(id=${z.id})`)
      .join(', ')}`,
  );

  // ==========================================================
  // 4. Rooms (3 per zone)
  // ==========================================================
  console.log('Creating rooms...');
  const rooms = await prisma.$transaction([
    // A区 rooms
    prisma.room.create({ data: { storeId, zoneId: zoneA.id, name: 'A01', capacity: 2, sortOrder: 1 } }),
    prisma.room.create({ data: { storeId, zoneId: zoneA.id, name: 'A02', capacity: 2, sortOrder: 2 } }),
    prisma.room.create({ data: { storeId, zoneId: zoneA.id, name: 'A03', capacity: 2, sortOrder: 3 } }),
    // B区 rooms
    prisma.room.create({ data: { storeId, zoneId: zoneB.id, name: 'VIP-1', capacity: 1, sortOrder: 1 } }),
    prisma.room.create({ data: { storeId, zoneId: zoneB.id, name: 'VIP-2', capacity: 1, sortOrder: 2 } }),
    prisma.room.create({ data: { storeId, zoneId: zoneB.id, name: 'VIP-3', capacity: 1, sortOrder: 3 } }),
    // C区 rooms
    prisma.room.create({ data: { storeId, zoneId: zoneC.id, name: '包间-1', capacity: 4, sortOrder: 1 } }),
    prisma.room.create({ data: { storeId, zoneId: zoneC.id, name: '包间-2', capacity: 4, sortOrder: 2 } }),
    prisma.room.create({ data: { storeId, zoneId: zoneC.id, name: '包间-3', capacity: 4, sortOrder: 3 } }),
  ]);
  console.log(`  Rooms created: ${rooms.map((r) => r.name).join(', ')}`);

  // ==========================================================
  // 5. Service Categories
  // ==========================================================
  console.log('Creating service categories...');
  const [catFootCare, catMassage, catSpa] = await prisma.$transaction([
    prisma.serviceCategory.create({ data: { storeId, name: '足疗', sortOrder: 1 } }),
    prisma.serviceCategory.create({ data: { storeId, name: '推拿', sortOrder: 2 } }),
    prisma.serviceCategory.create({ data: { storeId, name: 'SPA', sortOrder: 3 } }),
  ]);
  console.log(
    `  Categories created: ${[catFootCare, catMassage, catSpa]
      .map((c) => `${c.name}(id=${c.id})`)
      .join(', ')}`,
  );

  // ==========================================================
  // 6. Services
  // ==========================================================
  console.log('Creating services...');
  const services = await prisma.$transaction([
    // 足疗
    prisma.service.create({
      data: {
        storeId,
        categoryId: catFootCare.id,
        name: '经典足疗',
        duration: 60,
        price: 128,
        memberPrice: 108,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        storeId,
        categoryId: catFootCare.id,
        name: '养生足疗',
        duration: 90,
        price: 198,
        memberPrice: 168,
        sortOrder: 2,
      },
    }),
    // 推拿
    prisma.service.create({
      data: {
        storeId,
        categoryId: catMassage.id,
        name: '全身推拿',
        duration: 60,
        price: 168,
        memberPrice: 148,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        storeId,
        categoryId: catMassage.id,
        name: '肩颈理疗',
        duration: 30,
        price: 98,
        memberPrice: 88,
        sortOrder: 2,
      },
    }),
    // SPA
    prisma.service.create({
      data: {
        storeId,
        categoryId: catSpa.id,
        name: '精油SPA',
        duration: 90,
        price: 298,
        memberPrice: 258,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        storeId,
        categoryId: catSpa.id,
        name: '泰式按摩',
        duration: 120,
        price: 388,
        memberPrice: 338,
        sortOrder: 2,
      },
    }),
  ]);
  console.log(
    `  Services created: ${services.map((s) => `${s.name}(id=${s.id})`).join(', ')}`,
  );

  const [svcClassicFoot, svcHealthFoot, svcFullMassage] = services;

  // ==========================================================
  // 7. Members
  // ==========================================================
  console.log('Creating members...');
  const members = await prisma.$transaction([
    prisma.member.create({
      data: {
        storeId,
        name: '陈先生',
        phone: '13900001111',
        cardNo: 'M20260001',
        balance: 1500,
        realBalance: 1000,
        giftBalance: 500,
        gender: 'male',
      },
    }),
    prisma.member.create({
      data: {
        storeId,
        name: '李女士',
        phone: '13900002222',
        cardNo: 'M20260002',
        balance: 800,
        realBalance: 600,
        giftBalance: 200,
        gender: 'female',
      },
    }),
    prisma.member.create({
      data: {
        storeId,
        name: '王老板',
        phone: '13900003333',
        cardNo: 'M20260003',
        balance: 5000,
        realBalance: 3000,
        giftBalance: 2000,
        gender: 'male',
        remark: 'VIP常客，喜欢包间',
      },
    }),
  ]);
  console.log(
    `  Members created: ${members.map((m) => `${m.name}(id=${m.id})`).join(', ')}`,
  );

  // ==========================================================
  // 8. Recharge Plans
  // ==========================================================
  console.log('Creating recharge plans...');
  const rechargePlans = await prisma.$transaction([
    // Amount-based plans
    prisma.rechargePlan.create({
      data: {
        storeId,
        planType: 'amount',
        name: '充500送50',
        payAmount: 500,
        giftAmount: 50,
        sortOrder: 1,
      },
    }),
    prisma.rechargePlan.create({
      data: {
        storeId,
        planType: 'amount',
        name: '充1000送150',
        payAmount: 1000,
        giftAmount: 150,
        sortOrder: 2,
      },
    }),
    prisma.rechargePlan.create({
      data: {
        storeId,
        planType: 'amount',
        name: '充2000送400',
        payAmount: 2000,
        giftAmount: 400,
        sortOrder: 3,
      },
    }),
    // Visit card plan
    prisma.rechargePlan.create({
      data: {
        storeId,
        planType: 'visit',
        name: '经典足疗10次卡',
        serviceId: svcClassicFoot.id,
        buyCount: 10,
        giftCount: 2,
        payAmount: 1080,
        giftAmount: 0,
        sortOrder: 4,
      },
    }),
  ]);
  console.log(
    `  Recharge plans created: ${rechargePlans.map((p) => p.name).join(', ')}`,
  );

  // ==========================================================
  // 9. Commission Rules
  // ==========================================================
  console.log('Creating commission rules...');
  const commRules = await prisma.$transaction([
    prisma.commissionRule.create({
      data: {
        storeId,
        serviceId: svcClassicFoot.id,
        commissionType: 'fixed',
        commissionValue: 30,
      },
    }),
    prisma.commissionRule.create({
      data: {
        storeId,
        serviceId: svcHealthFoot.id,
        commissionType: 'fixed',
        commissionValue: 50,
      },
    }),
    prisma.commissionRule.create({
      data: {
        storeId,
        serviceId: svcFullMassage.id,
        commissionType: 'percentage',
        commissionValue: 20,
      },
    }),
  ]);
  console.log(
    `  Commission rules created: ${commRules.map((r) => `serviceId=${r.serviceId} ${r.commissionType}=${r.commissionValue}`).join(', ')}`,
  );

  // ==========================================================
  // 10. Schedules (today)
  // ==========================================================
  console.log('Creating schedules for today...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedules = await prisma.$transaction([
    prisma.schedule.create({
      data: {
        storeId,
        technicianId: wangTech.id,
        scheduleDate: today,
        shiftStart: '10:00',
        shiftEnd: '22:00',
        rotationOrder: 1,
        status: 'on_duty',
      },
    }),
    prisma.schedule.create({
      data: {
        storeId,
        technicianId: zhaoTech.id,
        scheduleDate: today,
        shiftStart: '10:00',
        shiftEnd: '22:00',
        rotationOrder: 2,
        status: 'on_duty',
      },
    }),
    prisma.schedule.create({
      data: {
        storeId,
        technicianId: liuTech.id,
        scheduleDate: today,
        shiftStart: '14:00',
        shiftEnd: '02:00',
        rotationOrder: 3,
        status: 'scheduled',
      },
    }),
  ]);
  console.log(
    `  Schedules created: ${schedules.map((s) => `techId=${s.technicianId} ${s.shiftStart}-${s.shiftEnd} (${s.status})`).join(', ')}`,
  );

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
