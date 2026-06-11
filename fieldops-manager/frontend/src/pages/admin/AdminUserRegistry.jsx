import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { userService } from "../../services/userService";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import FormField, { inputClass, selectClass } from "../../components/common/FormField";
import { PageSpinner } from "../../components/common/Spinner";
import { genPassword } from "../../utils/formatters";
import { ROLE_LABELS } from "../../constants/roles";

const Avatar = ({ name }) => {
  const initials = name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-accent2 flex items-center justify-center text-xs font-bold text-accent">
      {initials}
    </div>
  );
};

const ROLES = ["Engineer", "Team_Leader", "Store_Manager"];

export default function AdminUserRegistry() {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Engineer", password: "password" });

  const { data: usersRes, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => userService.create(data),
    onSuccess: () => {
      toast.success("User added successfully!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ name: "", email: "", role: "Engineer", password: "password" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to add user"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, newPassword }) => {
      await userService.update(id, { name: data.name, role: data.role });
      if (newPassword) await userService.resetPassword(id, { password: newPassword });
    },
    onSuccess: () => {
      toast.success("User updated!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Update failed"),
  });

  const handleCreate = () => {
    if (!newUser.name || !newUser.email) { toast.error("Enter name and email"); return; }
    createMutation.mutate(newUser);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name, role: user.role, newPassword: "" });
  };

  const handleSave = () => {
    if (!editForm.name) { toast.error("Name cannot be empty"); return; }
    updateMutation.mutate({ id: editUser.id, data: editForm, newPassword: editForm.newPassword });
  };

  if (isLoading) return <PageSpinner />;

  const users = usersRes || [];
  const engineers = users.filter((u) => u.role === "Engineer");
  const tlUsers = users.filter((u) => u.role === "Team_Leader");
  const storeUsers = users.filter((u) => u.role === "Store_Manager");

  return (
    <div>
      <div className="mb-5"><h1 className="text-xl font-bold">User Registry</h1></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Add New User</CardTitle>
          <FormField label="Full Name">
            <input type="text" className={inputClass} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Full name" />
          </FormField>
          <FormField label="Email">
            <input type="email" className={inputClass} value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@fieldops.com" />
          </FormField>
          <FormField label="Role">
            <select className={selectClass} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </FormField>
          <FormField label="Password">
            <div className="flex gap-2">
              <input type="text" className={inputClass} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Set password" />
              <Button size="sm" onClick={() => setNewUser({ ...newUser, password: genPassword() })}>
                <i className="ti ti-refresh" />
              </Button>
            </div>
          </FormField>
          <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
            <i className="ti ti-user-plus" />
            {createMutation.isPending ? "Adding..." : "Add User"}
          </Button>
        </Card>

        <Card>
          <CardTitle>Staff — TL & Store Manager</CardTitle>
          {["Team_Leader", "Store_Manager"].map((role) => {
            const roleUsers = users.filter((u) => u.role === role);
            return (
              <div key={role} className="mb-3">
                <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">{ROLE_LABELS[role]}</div>
                {roleUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} />
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      <i className="ti ti-edit" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
      </div>

      <Card>
        <CardTitle>Engineers ({engineers.length} active)</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Total Logs</th><th>Action</th></tr>
            </thead>
            <tbody>
              {engineers.map((eng) => (
                <tr key={eng.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={eng.name} />
                      <strong>{eng.name}</strong>
                    </div>
                  </td>
                  <td className="text-muted text-xs">{eng.email}</td>
                  <td>—</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(eng)}>
                      <i className="ti ti-edit" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit User — ${editUser?.name}`}>
        <FormField label="Full Name">
          <input type="text" className={inputClass} value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </FormField>
        <FormField label="Email">
          <input className={inputClass} value={editUser?.email || ""} disabled style={{ opacity: 0.6 }} />
        </FormField>
        <FormField label="Role">
          <select className={selectClass} value={editForm.role || ""} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </FormField>
        <hr className="border-border my-3" />
        <FormField label="New Password (leave blank to keep current)">
          <div className="flex gap-2">
            <input type="text" className={inputClass} value={editForm.newPassword || ""} onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })} placeholder="New password..." />
            <Button size="sm" onClick={() => setEditForm({ ...editForm, newPassword: genPassword() })}>
              <i className="ti ti-refresh" />
            </Button>
          </div>
        </FormField>
        <div className="flex gap-2 justify-end mt-2">
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={updateMutation.isPending}>
            <i className="ti ti-device-floppy" /> Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
