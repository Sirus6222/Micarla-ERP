
import React, { useState, useEffect } from 'react';
import { UserService } from '../services/store';
import { User, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Mail, Edit2, Trash2, User as UserIcon, X, Check, AlertCircle } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<(User & { email?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Role Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<Role>(Role.SALES_REP);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await UserService.getAll();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setNewRole(user.role);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    try {
      await UserService.update({ ...editingUser, role: newRole });
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      alert("Failed to update user role.");
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this user? They will effectively lose access to the system.")) return;
    try {
      await UserService.delete(userId);
      await loadUsers();
    } catch (err) {
      alert("Failed to delete user.");
      console.error(err);
    }
  };

  if (loading) return <div className="p-12 text-center text-stone-500">Loading User Directory...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
            <Shield className="text-primary-600" size={32} />
            User Management
          </h2>
          <p className="text-stone-500 mt-1">Manage system access, roles, and privileges.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 max-w-md">
           <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
           <p className="text-xs text-blue-800">
             <strong>Note:</strong> To add new users, instruct them to sign up via the login page. As an Admin, you can then promote their role here.
           </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead className="bg-stone-50 text-stone-500 text-xs uppercase font-bold tracking-wider">
               <tr>
                 <th className="px-6 py-4">User Identity</th>
                 <th className="px-6 py-4">Role / Access Level</th>
                 <th className="px-6 py-4">Email</th>
                 <th className="px-6 py-4 text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-stone-100">
               {users.map(u => (
                 <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold border border-stone-200">
                         {u.avatarInitials}
                       </div>
                       <div>
                         <div className="font-bold text-stone-900">{u.name}</div>
                         <div className="text-xs text-stone-400 font-mono">ID: {u.id.substring(0,8)}...</div>
                       </div>
                     </div>
                   </td>
                   <td className="px-6 py-4">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                       u.role === Role.ADMIN ? 'bg-purple-100 text-purple-700 border-purple-200' :
                       u.role === Role.MANAGER ? 'bg-blue-100 text-blue-700 border-blue-200' :
                       u.role === Role.FINANCE ? 'bg-green-100 text-green-700 border-green-200' :
                       u.role === Role.FACTORY ? 'bg-orange-100 text-orange-700 border-orange-200' :
                       'bg-stone-100 text-stone-600 border-stone-200'
                     }`}>
                       {u.role}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-sm text-stone-600">
                     <div className="flex items-center gap-2">
                       <Mail size={14} className="text-stone-400" />
                       {u.email || 'N/A'}
                     </div>
                   </td>
                   <td className="px-6 py-4 text-right">
                     {u.id !== currentUser?.id && (
                       <div className="flex justify-end gap-2">
                         <button 
                           onClick={() => handleEditClick(u)}
                           className="p-2 text-stone-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                           title="Edit Role"
                         >
                           <Edit2 size={18} />
                         </button>
                         <button 
                           onClick={() => handleDeleteUser(u.id)}
                           className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                           title="Remove User"
                         >
                           <Trash2 size={18} />
                         </button>
                       </div>
                     )}
                     {u.id === currentUser?.id && (
                       <span className="text-xs text-stone-400 italic">Current User</span>
                     )}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in duration-150">
             <div className="p-5 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-xl">
                <h3 className="font-bold text-stone-800">Edit User Privileges</h3>
                <button onClick={() => setEditingUser(null)} className="text-stone-400 hover:text-stone-800"><X size={20}/></button>
             </div>
             <div className="p-6">
                <div className="flex items-center gap-3 mb-6 p-3 bg-stone-50 rounded-lg border border-stone-200">
                   <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold shadow-sm">{editingUser.avatarInitials}</div>
                   <div>
                      <div className="font-bold text-stone-900">{editingUser.name}</div>
                      <div className="text-xs text-stone-500">{editingUser.role}</div>
                   </div>
                </div>

                <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Assign New Role</label>
                <div className="space-y-2">
                   {Object.values(Role).map(role => (
                     <label key={role} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${newRole === role ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-stone-200 hover:bg-stone-50'}`}>
                        <input 
                          type="radio" 
                          name="role" 
                          value={role} 
                          checked={newRole === role} 
                          onChange={() => setNewRole(role)}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                        />
                        <span className={`text-sm font-medium ${newRole === role ? 'text-primary-900' : 'text-stone-700'}`}>{role}</span>
                     </label>
                   ))}
                </div>

                <div className="flex gap-3 mt-8">
                   <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 text-stone-500 font-bold hover:bg-stone-50 rounded-lg">Cancel</button>
                   <button onClick={handleSaveRole} className="flex-1 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 shadow-sm">Save Changes</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
