const http = require('http');
const API = 'http://43.138.68.65:3000';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers, timeout: 10000 };
    const r = http.request(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  let pass = 0, fail = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('[PASS]', name, detail || ''); }
    else { fail++; console.log('[FAIL]', name, detail || ''); }
  }

  // 1. Health
  const h = await req('GET', '/health');
  check('Health check', h.status === 'ok');

  // 2. Login admin
  const login = await req('POST', '/api/v1/auth/wx-login', { code: 'dev-E001' });
  check('Login admin', login.code === 0 && !login.data.needBind, login.data.employee?.name);
  const TOKEN = login.data.token;

  // 3. Login cashier
  const login2 = await req('POST', '/api/v1/auth/wx-login', { code: 'dev-E002' });
  check('Login cashier', login2.code === 0, login2.data.employee?.name);

  // 4. Login technician
  const login3 = await req('POST', '/api/v1/auth/wx-login', { code: 'dev-E003' });
  check('Login technician', login3.code === 0, login3.data.employee?.name);

  // 5. Profile
  const prof = await req('GET', '/api/v1/auth/profile', null, TOKEN);
  check('Profile', prof.code === 0 && prof.data.name === '张店长');

  // 6. Rooms overview
  const rooms = await req('GET', '/api/v1/rooms/overview', null, TOKEN);
  check('Rooms overview', rooms.code === 0 && rooms.data.zones.length === 3, 'zones=' + rooms.data.zones.length + ' total=' + rooms.data.stats.total);

  // 7. Services
  const svcs = await req('GET', '/api/v1/services', null, TOKEN);
  check('Services list', svcs.code === 0 && svcs.data.length === 6, 'count=' + svcs.data.length);

  // 8. Employees
  const emps = await req('GET', '/api/v1/employees', null, TOKEN);
  check('Employees list', emps.code === 0 && emps.data.length === 5, 'count=' + emps.data.length);

  // 9. Members search
  const mems = await req('GET', '/api/v1/members?keyword=139', null, TOKEN);
  check('Members search', mems.code === 0 && mems.data.total === 3, 'total=' + mems.data.total);

  // 10. Recharge plans
  const plans = await req('GET', '/api/v1/recharge-plans', null, TOKEN);
  check('Recharge plans', plans.code === 0 && plans.data.length === 4, 'count=' + plans.data.length);

  // 11. Commission rules
  const crules = await req('GET', '/api/v1/commission-rules', null, TOKEN);
  check('Commission rules', crules.code === 0 && crules.data.length >= 3, 'count=' + crules.data.length);

  // Find idle room
  let idleRoomId = null;
  for (const z of rooms.data.zones) {
    for (const r of z.rooms) {
      if (r.currentStatus === 'idle') { idleRoomId = r.id; break; }
    }
    if (idleRoomId) break;
  }
  console.log('  Using idle room:', idleRoomId);

  // 12. Create order with member (陈先生 id=1, memberPrice=108 for service 1)
  const order = await req('POST', '/api/v1/orders', {
    roomId: idleRoomId, memberId: 1,
    items: [{ serviceId: 1, technicianId: 3, quantity: 1 }]
  }, TOKEN);
  check('Create member order', order.code === 0, 'orderNo=' + order.data?.orderNo + ' actual=' + order.data?.actualAmount);
  const orderId = order.data?.id;

  // Verify member price applied (108 not 128)
  check('Member price applied', order.data?.actualAmount === '108', 'price=' + order.data?.actualAmount);

  // 13. Add item
  const addItem = await req('POST', '/api/v1/orders/' + orderId + '/items', {
    items: [{ serviceId: 4, technicianId: 4, quantity: 1 }]
  }, TOKEN);
  check('Add order item', addItem.code === 0, 'newTotal=' + addItem.data?.totalAmount);

  // 14. Order detail
  const detail = await req('GET', '/api/v1/orders/' + orderId, null, TOKEN);
  check('Order detail', detail.code === 0 && detail.data.orderItems.length === 2, 'items=' + detail.data?.orderItems?.length);

  // 15. Checkout with member_balance (total = 108 + 88 = 196, member balance = 1500)
  const checkout = await req('POST', '/api/v1/orders/' + orderId + '/checkout', { paymentType: 'member_balance' }, TOKEN);
  check('Checkout member_balance', checkout.code === 0 && checkout.data?.orderStatus === 'completed', 'actual=' + checkout.data?.actualAmount);

  // 16. Verify member balance decreased (1500 - 196 = 1304)
  const mem1 = await req('GET', '/api/v1/members/1', null, TOKEN);
  check('Member balance deducted', mem1.code === 0 && parseFloat(mem1.data.balance) < 1500, 'balance=' + mem1.data?.balance + ' gift=' + mem1.data?.giftBalance);

  // 17. Refund
  const refund = await req('POST', '/api/v1/orders/' + orderId + '/refund', {}, TOKEN);
  check('Refund order', refund.code === 0, refund.message || '');

  // 18. Verify balance restored
  const mem2 = await req('GET', '/api/v1/members/1', null, TOKEN);
  check('Balance restored after refund', parseFloat(mem2.data.balance) === 1500, 'balance=' + mem2.data?.balance);

  // 19. Recharge member (充500送50)
  const recharge = await req('POST', '/api/v1/members/1/recharge', { planId: 1, paymentMethod: 'cash' }, TOKEN);
  check('Member recharge', recharge.code === 0, 'newBalance=' + recharge.data?.member?.balance);

  // 20. Verify balance after recharge (1500 + 500 + 50 = 2050)
  const mem3 = await req('GET', '/api/v1/members/1', null, TOKEN);
  check('Recharge balance correct', parseFloat(mem3.data.balance) === 2050, 'balance=' + mem3.data?.balance + ' real=' + mem3.data?.realBalance + ' gift=' + mem3.data?.giftBalance);

  // 21. Dashboard report
  const dash = await req('GET', '/api/v1/reports/dashboard', null, TOKEN);
  check('Dashboard report', dash.code === 0 && dash.data?.revenue !== undefined, 'revenue=' + dash.data?.revenue + ' orders=' + dash.data?.orderCount);

  // 22. Today orders
  const today = await req('GET', '/api/v1/orders/today', null, TOKEN);
  check('Today orders', today.code === 0, 'count=' + today.data?.length);

  // 23. Commission records
  const comm = await req('GET', '/api/v1/commissions', null, TOKEN);
  check('Commission records', comm.code === 0 && comm.data.length > 0, 'technicians=' + comm.data?.length);

  // 24. Schedule query
  const sched = await req('GET', '/api/v1/schedules?date=2026-03-02', null, TOKEN);
  check('Schedule query', sched.code === 0);

  // 25. Store info
  const stores = await req('GET', '/api/v1/stores', null, TOKEN);
  check('Store info', stores.code === 0);

  // 26. Feature flags
  const flags = await req('GET', '/api/v1/feature-flags', null, TOKEN);
  check('Feature flags', flags.code === 0);

  // 27. RBAC: cashier cannot refund (only admin can)
  const T2 = login2.data.token;
  const rbac = await req('POST', '/api/v1/orders/2/refund', {}, T2);
  check('RBAC cashier cannot refund', rbac.code !== 0, 'code=' + rbac.code);

  // 28. Revenue report
  const rev = await req('GET', '/api/v1/reports/revenue?startDate=2026-03-01&endDate=2026-03-02', null, TOKEN);
  check('Revenue report', rev.code === 0, 'data=' + JSON.stringify(rev.data).substring(0, 80));

  // 29. Staff performance
  const perf = await req('GET', '/api/v1/reports/staff-performance?startDate=2026-03-01&endDate=2026-03-02', null, TOKEN);
  check('Staff performance', perf.code === 0);

  // 30. Member stats
  const mstat = await req('GET', '/api/v1/reports/member-stats?startDate=2026-03-01&endDate=2026-03-02', null, TOKEN);
  check('Member stats report', mstat.code === 0);

  console.log('\n========================================');
  console.log('TOTAL: ' + pass + ' passed, ' + fail + ' failed out of ' + (pass + fail) + ' tests');
  console.log('========================================');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
