import React, { useState } from 'react';
import { Users, Tag, Activity } from 'lucide-react';
import UsersView from './UsersView';
import SupplierTypesView from './SupplierTypesView';
import StatusView from './StatusView';
import ManufacturersView from './ManufacturersView';
import MedicinesView from './MedicinesView';

/**
 * Administrative Hub component that provides tabs for managing users, medicines,
 * manufacturers, supplier types, and statuses.
 * 
 * @param {Object} props - Component properties.
 * @param {Array} props.users - List of users.
 * @param {function} props.onAddUser - Callback to open the add user modal.
 * @param {function} props.onEditUser - Callback to open the edit user modal.
 * @param {function} props.onDeleteUser - Callback to delete a user.
 * @param {Array} props.supplierTypes - List of supplier types.
 * @param {function} props.onSaveType - Callback to save a supplier type.
 * @param {function} props.onDeleteType - Callback to delete a supplier type.
 * @param {Array} props.statuses - List of statuses.
 * @param {function} props.onSaveStatus - Callback to save a status.
 * @param {function} props.onDeleteStatus - Callback to delete a status.
 * @param {Array} props.manufacturers - List of manufacturers.
 * @param {function} props.onAddManufacturer - Callback to add a manufacturer.
 * @param {function} props.onEditManufacturer - Callback to edit a manufacturer.
 * @param {function} props.onDeleteManufacturer - Callback to delete a manufacturer.
 * @param {Array} props.medicines - List of medicine master entries.
 * @param {function} props.onAddMedicineMaster - Callback to add a medicine master.
 * @param {function} props.onEditMedicineMaster - Callback to edit a medicine master.
 * @param {function} props.onDeleteMedicineMaster - Callback to delete a medicine master.
 * @param {Object} props.currentUser - The currently logged-in user.
 */
const AdminView = ({ 
    users, onAddUser, onEditUser, onDeleteUser,
    supplierTypes, onSaveType, onDeleteType,
    statuses, onSaveStatus, onDeleteStatus,
    manufacturers, onAddManufacturer, onEditManufacturer, onDeleteManufacturer,
    medicines, onAddMedicineMaster, onEditMedicineMaster, onDeleteMedicineMaster,
    currentUser
}) => {
    const [activeTab, setActiveTab] = useState('users');

    const tabs = [
        { id: 'users', name: 'Users', icon: Users, count: users?.length },
        { id: 'medicines', name: 'Medicine Master', icon: Activity, count: medicines?.length }, // Using Activity as icon since Package is in sidebar or import it
        { id: 'manufacturers', name: 'Manufacturers', icon: Tag, count: manufacturers?.length },
        { id: 'types', name: 'Supplier Types', icon: Tag, count: supplierTypes?.length },
        { id: 'status', name: 'Statuses', icon: Activity, count: statuses?.length }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Administrative Hub</h1>
                <p className="text-gray-500 font-medium">Manage system-wide configurations and access control</p>
            </div>

            {/* Tabs Navigation */}
            <div className="flex p-1.5 bg-gray-100/50 rounded-2xl w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2.5 px-6 py-3 rounded-xl font-bold transition-all ${
                            activeTab === tab.id 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.name}</span>
                        {tab.count !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeTab === 'users' && (
                    <UsersView 
                        users={users} 
                        onAddClick={onAddUser} 
                        onEditClick={onEditUser} 
                        onDeleteClick={onDeleteUser} 
                    />
                )}
                {activeTab === 'types' && (
                    <SupplierTypesView 
                        types={supplierTypes} 
                        onSave={onSaveType} 
                        onDelete={onDeleteType} 
                    />
                )}
                {activeTab === 'status' && (
                    <StatusView 
                        statuses={statuses} 
                        onSave={onSaveStatus} 
                        onDelete={onDeleteStatus} 
                    />
                )}
                {activeTab === 'manufacturers' && (
                    <ManufacturersView 
                        manufacturers={manufacturers}
                        onAddClick={onAddManufacturer}
                        onEditClick={onEditManufacturer}
                        onDeleteClick={onDeleteManufacturer}
                        currentUser={currentUser}
                    />
                )}
                {activeTab === 'medicines' && (
                    <MedicinesView 
                        medicines={medicines}
                        onAddClick={onAddMedicineMaster}
                        onEditClick={onEditMedicineMaster}
                        onDeleteClick={onDeleteMedicineMaster}
                        currentUser={currentUser}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminView;
