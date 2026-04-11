import React, { useState } from 'react';

export const useRole = () => {
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'operator');

  const setRole = (role) => {
    localStorage.setItem('userRole', role);
    setUserRole(role);
  };

  return { userRole, setRole };
};

export const RoleBasedAccess = ({ role, children, fallback = null }) => {
  const { userRole } = useRole();

  if (Array.isArray(role)) {
    return role.includes(userRole) ? children : fallback;
  }

  return userRole === role ? children : fallback;
};

export default function RoleManager() {
  const { userRole, setRole } = useRole();

  const roles = [
    {
      id: 'admin',
      name: '👤 Admin',
      description: 'Full access to all features, system settings, and user management',
      icon: '🔐',
      permissions: ['view_all', 'edit_settings', 'manage_users', 'view_reports', 'export_data', 'manage_cameras'],
    },
    {
      id: 'supervisor',
      name: '👨‍💼 Supervisor',
      description: 'Monitor all zones, generate reports, manage camera assignments',
      icon: '📊',
      permissions: ['view_all', 'view_reports', 'manage_assignments', 'export_data'],
    },
    {
      id: 'operator',
      name: '👨‍⚙️ Operator',
      description: 'View and monitor assigned camera zones only, create incident reports',
      icon: '📹',
      permissions: ['view_assigned_zone', 'create_reports', 'view_incidents'],
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🔐 Role-Based Access Control</h3>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Current Role:</strong> {roles.find((r) => r.id === userRole)?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            onClick={() => setRole(role.id)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition ${
              userRole === role.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xl">{role.icon}</p>
              {userRole === role.id && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">SELECTED</span>}
            </div>
            <p className="font-semibold text-gray-900 mb-1">{role.name}</p>
            <p className="text-xs text-gray-600 mb-3">{role.description}</p>

            {/* Permissions List */}
            <div className="text-xs space-y-1">
              <p className="font-semibold text-gray-700 mb-2">Permissions:</p>
              {role.permissions.map((perm) => (
                <div key={perm} className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-600">{perm.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setRole(role.id)}
              className={`w-full mt-4 px-3 py-2 rounded font-semibold transition text-sm ${
                userRole === role.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {userRole === role.id ? '✓ Selected' : 'Select Role'}
            </button>
          </div>
        ))}
      </div>

      {/* Role-based Feature Table */}
      <div className="mt-8">
        <h4 className="font-semibold text-gray-900 mb-4">📋 Feature Access Matrix</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Feature</th>
                <th className="border border-gray-300 p-2 text-center">Admin</th>
                <th className="border border-gray-300 p-2 text-center">Supervisor</th>
                <th className="border border-gray-300 p-2 text-center">Operator</th>
              </tr>
            </thead>
            <tbody>
              {[
                'View All Cameras',
                'View Assigned Zone',
                'Generate Reports',
                'Export Data',
                'Manage Users',
                'System Settings',
                'Create Incidents',
                'View Analytics',
              ].map((feature, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 p-2 font-medium text-gray-700">{feature}</td>
                  <td className="border border-gray-300 p-2 text-center">
                    <span className="text-green-600 font-bold">✓</span>
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <span className={feature === 'Manage Users' || feature === 'System Settings' ? 'text-gray-300' : 'text-green-600 font-bold'}>
                      {feature === 'Manage Users' || feature === 'System Settings' ? '✗' : '✓'}
                    </span>
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <span className={['View All Cameras', 'Export Data', 'Manage Users', 'System Settings', 'View Analytics'].includes(feature) ? 'text-gray-300' : 'text-green-600 font-bold'}>
                      {['View All Cameras', 'Export Data', 'Manage Users', 'System Settings', 'View Analytics'].includes(feature) ? '✗' : '✓'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
