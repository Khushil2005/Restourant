import { Schema, model, Document } from 'mongoose';

export interface IPermission extends Document {
  id: string;
  module: string;
  submodule: string;
  action: string;
  name: string;
  description: string;
  createdAt: Date;
}

const PermissionSchema = new Schema<IPermission>({
  id: { type: String, required: true, unique: true },
  module: { type: String, required: true, index: true },
  submodule: { type: String, required: true },
  action: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
}, { timestamps: true });

export interface IRole extends Document {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[]; // List of permission IDs
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isSystem: { type: Boolean, default: false },
  permissions: [{ type: String }],
}, { timestamps: true });

export const Permission = model<IPermission>('Permission', PermissionSchema);
export const Role = model<IRole>('Role', RoleSchema);
