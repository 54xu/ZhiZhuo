/**
 * Auth service tests
 * Tests for wxLogin, bindEmployee, getProfile
 */

import { AuthService } from '../modules/auth/auth.service';
import { verifyToken } from '../middleware/auth.middleware';

// Mock the Prisma client
function createMockPrisma() {
  return {
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    authService = new AuthService(mockPrisma);
    // Ensure NODE_ENV is not production so code2Session uses mock mode
    process.env.NODE_ENV = 'test';
    // Clear wx config so mock mode is activated
    delete process.env.WX_APPID;
    delete process.env.WX_APP_SECRET;
  });

  describe('wxLogin', () => {
    it('should return mock openid in non-production mode without wx config', async () => {
      // Employee not found for the mock openid
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      const result = await authService.wxLogin('test_code_123');

      expect(result.needBind).toBe(true);
      expect(result.openid).toBe('mock_openid_test_code_123');
      expect(result.token).toBeUndefined();
    });

    it('should return token when employee is bound to the openid', async () => {
      const mockEmployee = {
        id: 1,
        name: 'Zhang San',
        employeeNo: 'EMP001',
        role: 'cashier',
        storeId: 1,
        wxOpenid: 'mock_openid_bound_code',
        status: 'active',
        store: { id: 1, name: 'Test Store' },
      };

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      const result = await authService.wxLogin('bound_code');

      expect(result.needBind).toBe(false);
      expect(result.token).toBeDefined();
      expect(result.employee).toEqual({
        id: 1,
        name: 'Zhang San',
        employeeNo: 'EMP001',
        role: 'cashier',
        store: { id: 1, name: 'Test Store' },
      });

      // Verify the token is valid
      const decoded = verifyToken(result.token!);
      expect(decoded.employeeId).toBe(1);
      expect(decoded.storeId).toBe(1);
      expect(decoded.role).toBe('cashier');
    });

    it('should return needBind=true when no employee is bound', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      const result = await authService.wxLogin('new_user_code');

      expect(result.needBind).toBe(true);
      expect(result.openid).toBe('mock_openid_new_user_code');
      expect(result.token).toBeUndefined();
      expect(result.employee).toBeUndefined();
    });

    it('should query employee with wxOpenid and active status', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await authService.wxLogin('any_code');

      expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith({
        where: {
          wxOpenid: 'mock_openid_any_code',
          status: 'active',
        },
        include: {
          store: { select: { id: true, name: true } },
        },
      });
    });
  });

  describe('bindEmployee', () => {
    it('should bind employee successfully and return token', async () => {
      const mockEmployee = {
        id: 2,
        name: 'Li Si',
        employeeNo: 'EMP002',
        phone: '13900139002',
        role: 'admin',
        storeId: 1,
        wxOpenid: null,
        status: 'active',
        store: { id: 1, name: 'Test Store' },
      };

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue({ ...mockEmployee, wxOpenid: 'openid_abc' });

      const result = await authService.bindEmployee('openid_abc', 'EMP002', '13900139002');

      expect(result.token).toBeDefined();
      expect(result.employee).toEqual({
        id: 2,
        name: 'Li Si',
        employeeNo: 'EMP002',
        role: 'admin',
        store: { id: 1, name: 'Test Store' },
      });

      // Should update the employee with the openid
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { wxOpenid: 'openid_abc' },
      });
    });

    it('should throw error when employeeNo and phone do not match', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        authService.bindEmployee('openid_xyz', 'WRONG_NO', '00000000000')
      ).rejects.toThrow('工号或手机号不匹配，请联系管理员');
    });

    it('should throw error when employee is already bound to another wechat', async () => {
      const mockEmployee = {
        id: 3,
        name: 'Wang Wu',
        employeeNo: 'EMP003',
        phone: '13900139003',
        role: 'technician',
        storeId: 1,
        wxOpenid: 'other_openid_existing',  // Already bound to different openid
        status: 'active',
        store: { id: 1, name: 'Test Store' },
      };

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      await expect(
        authService.bindEmployee('new_openid_different', 'EMP003', '13900139003')
      ).rejects.toThrow('该员工已绑定其他微信，请联系管理员解绑');
    });

    it('should allow re-binding the same openid', async () => {
      const mockEmployee = {
        id: 3,
        name: 'Wang Wu',
        employeeNo: 'EMP003',
        phone: '13900139003',
        role: 'technician',
        storeId: 1,
        wxOpenid: 'same_openid',  // Same openid
        status: 'active',
        store: { id: 1, name: 'Test Store' },
      };

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue(mockEmployee);

      const result = await authService.bindEmployee('same_openid', 'EMP003', '13900139003');

      expect(result.token).toBeDefined();
      expect(result.employee.name).toBe('Wang Wu');
    });
  });

  describe('getProfile', () => {
    it('should return employee profile with store info', async () => {
      const mockEmployee = {
        id: 1,
        name: 'Zhang San',
        employeeNo: 'EMP001',
        phone: '13800138000',
        role: 'cashier',
        skills: '["massage","foot_spa"]',
        store: {
          id: 1,
          name: 'Test Store',
          address: '123 Test St',
          phone: '021-12345678',
          businessHours: '10:00-22:00',
        },
      };

      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);

      const profile = await authService.getProfile(1);

      expect(profile).toEqual({
        id: 1,
        name: 'Zhang San',
        employeeNo: 'EMP001',
        phone: '13800138000',
        role: 'cashier',
        skills: ['massage', 'foot_spa'],
        store: {
          id: 1,
          name: 'Test Store',
          address: '123 Test St',
          phone: '021-12345678',
          businessHours: '10:00-22:00',
        },
      });
    });

    it('should return empty skills array when employee has no skills', async () => {
      const mockEmployee = {
        id: 2,
        name: 'Li Si',
        employeeNo: 'EMP002',
        phone: '13900139002',
        role: 'admin',
        skills: null,
        store: { id: 1, name: 'Test Store', address: null, phone: null, businessHours: null },
      };

      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);

      const profile = await authService.getProfile(2);

      expect(profile.skills).toEqual([]);
    });

    it('should throw error when employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(authService.getProfile(999)).rejects.toThrow('员工不存在');
    });

    it('should query with correct employeeId', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      try {
        await authService.getProfile(42);
      } catch (_) {
        // expected
      }

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        include: {
          store: { select: { id: true, name: true, address: true, phone: true, businessHours: true } },
        },
      });
    });
  });
});
