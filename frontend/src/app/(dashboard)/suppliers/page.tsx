'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SupplierForm } from '@/components/dashboard/supplier-form';
import { RoleGate } from '@/components/shared/role-gate';
import { getDb } from '@/lib/db/dexie';
import { syncEngine } from '@/lib/sync/sync-engine';
import { getErrorMessage } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type { SupplierResponse } from '@/types/api';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierResponse | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    try {
      const db = getDb();
      const localSuppliers = await db.suppliers.toArray();

      const mappedSuppliers: SupplierResponse[] = localSuppliers.map((sup) => ({
        id: sup.id?.toString() ?? '',
        uuid: sup.uuid,
        shopId: sup.shopId.toString(),
        name: sup.name,
        phone: sup.phone,
        email: sup.email,
        address: sup.address,
        notes: sup.notes,
        productCount: (sup as any).productCount ?? 0,
        stockMovementCount: (sup as any).stockMovementCount ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      setSuppliers(mappedSuppliers);
      setLoading(false);

      if (navigator.onLine) {
        try {
          const response = await apiClient.get<{ success: boolean; data: SupplierResponse[] }>('/suppliers');
          const serverSuppliers = response.data.data;

          await db.transaction('rw', db.suppliers, async () => {
            const serverUuids = new Set(serverSuppliers.map((s) => s.uuid));
            
            for (const ssup of serverSuppliers) {
              const existing = await db.suppliers.where('uuid').equals(ssup.uuid).first();
              if (existing) {
                await db.suppliers.update(existing.id!, {
                  shopId: parseInt(ssup.shopId),
                  name: ssup.name,
                  phone: ssup.phone,
                  email: ssup.email,
                  address: ssup.address,
                  notes: ssup.notes,
                  syncedAt: new Date().toISOString(),
                  productCount: ssup.productCount,
                  stockMovementCount: ssup.stockMovementCount,
                } as any);
              } else {
                await db.suppliers.add({
                  uuid: ssup.uuid,
                  shopId: parseInt(ssup.shopId),
                  name: ssup.name,
                  phone: ssup.phone,
                  email: ssup.email,
                  address: ssup.address,
                  notes: ssup.notes,
                  syncedAt: new Date().toISOString(),
                  productCount: ssup.productCount,
                  stockMovementCount: ssup.stockMovementCount,
                } as any);
              }
            }

            const allLocal = await db.suppliers.toArray();
            for (const lsup of allLocal) {
              if (lsup.syncedAt !== null && !serverUuids.has(lsup.uuid)) {
                await db.suppliers.delete(lsup.id!);
              }
            }
          });

          const updatedLocal = await db.suppliers.toArray();
          setSuppliers(
            updatedLocal.map((sup) => ({
              id: sup.id?.toString() ?? '',
              uuid: sup.uuid,
              shopId: sup.shopId.toString(),
              name: sup.name,
              phone: sup.phone,
              email: sup.email,
              address: sup.address,
              notes: sup.notes,
              productCount: (sup as any).productCount ?? 0,
              stockMovementCount: (sup as any).stockMovementCount ?? 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }))
          );
        } catch (err: unknown) {
          console.warn('[Suppliers] Failed to sync with backend:', getErrorMessage(err));
        }
      }
    } catch (error: unknown) {
      toast.error('Failed to load suppliers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleDelete = async (supplier: SupplierResponse) => {
    if (confirmDeleteId !== supplier.uuid) {
      setConfirmDeleteId(supplier.uuid);
      return;
    }

    try {
      const db = getDb();
      
      if (supplier.productCount > 0) {
        toast.error('Supplier has linked products. Unlink products before deleting.');
        setConfirmDeleteId(null);
        return;
      }

      await db.suppliers.where('uuid').equals(supplier.uuid).delete();

      await syncEngine.enqueue('suppliers', 'DELETE', {
        id: supplier.id ? parseInt(supplier.id) : undefined,
        uuid: supplier.uuid,
      });

      if (navigator.onLine && supplier.id) {
        apiClient.delete(`/suppliers/${supplier.id}`).catch((err: unknown) => {
          console.error('[Suppliers] Failed to delete in background:', getErrorMessage(err));
        });
      }

      toast.success('Supplier deleted successfully');
      setConfirmDeleteId(null);
      loadSuppliers();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to delete supplier');
    }
  };

  const handleEditClick = (supplier: SupplierResponse) => {
    setEditingSupplier(supplier);
    setIsSheetOpen(true);
  };

  const handleAddClick = () => {
    setEditingSupplier(undefined);
    setIsSheetOpen(true);
  };

  const handleSheetSuccess = () => {
    setIsSheetOpen(false);
    loadSuppliers();
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setConfirmDeleteId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <RoleGate anyRole={['owner', 'super_admin']}>
      <div className="space-y-6 animate-fade-in" onClick={() => setConfirmDeleteId(null)}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground mt-1">
              Manage your stock suppliers and their contact information.
            </p>
          </div>
          <Button onClick={handleAddClick} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        </div>

        {suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 p-12 text-center bg-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Truck className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No suppliers yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Add your first supplier to start managing stock origins.
            </p>
            <Button onClick={handleAddClick} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="w-32 text-center">Products</TableHead>
                  <TableHead className="w-48 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.uuid} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {supplier.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {supplier.email && <div className="text-muted-foreground">{supplier.email}</div>}
                      {supplier.phone && <div className="text-muted-foreground">{supplier.phone}</div>}
                      {!supplier.email && !supplier.phone && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {supplier.address || '—'}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {supplier.productCount}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(supplier)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={confirmDeleteId === supplier.uuid ? 'destructive' : 'ghost'}
                          onClick={() => handleDelete(supplier)}
                          className="min-w-[80px]"
                        >
                          {confirmDeleteId === supplier.uuid ? (
                            'Confirm?'
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="sm:max-w-md w-full bg-card overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </SheetTitle>
              <SheetDescription>
                {editingSupplier
                  ? 'Make changes to your supplier details below.'
                  : 'Create a new supplier for your stock inventory.'}
              </SheetDescription>
            </SheetHeader>
            <SupplierForm
              supplier={editingSupplier}
              onSuccess={handleSheetSuccess}
            />
          </SheetContent>
        </Sheet>
      </div>
    </RoleGate>
  );
}
