// frontend/app/(dashboard)/products/categories/page.tsx
// Purpose: Category list — create, edit, delete categories with inline confirmation.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Folder, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
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
import { CategoryForm } from '@/components/dashboard/category-form';
import { getDb } from '@/lib/db/dexie';
import { syncEngine } from '@/lib/sync/sync-engine';
import { getErrorMessage } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type { CategoryResponse } from '@/types/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryResponse | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Fetch & Sync Categories ───────────────────────────────────────────────

  const loadCategories = useCallback(async () => {
    try {
      const db = getDb();
      // 1. Get all local categories from IndexedDB
      const localCats = await db.categories.toArray();

      // Convert LocalCategory to CategoryResponse shape for UI consistency
      const mappedCats: CategoryResponse[] = localCats.map((cat) => ({
        id: cat.id?.toString() ?? '',
        uuid: cat.uuid,
        shopId: cat.shopId.toString(),
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
        productCount: cat.productCount ?? 0,
        createdAt: new Date().toISOString(), // fallback
        updatedAt: new Date().toISOString(), // fallback
      }));

      setCategories(mappedCats);
      setLoading(false);

      // 2. If online, fetch from backend to update local IndexedDB
      if (navigator.onLine) {
        try {
          const response = await apiClient.get<{ success: boolean; data: CategoryResponse[] }>('/categories');
          const serverCats = response.data.data;

          // Perform background reconciliation in IndexedDB
          await db.transaction('rw', db.categories, async () => {
            // Overwrite categories in IndexedDB with server data (excluding unsynced ones)
            for (const scat of serverCats) {
              const existing = await db.categories.where('uuid').equals(scat.uuid).first();
              if (existing) {
                await db.categories.update(existing.id!, {
                  shopId: parseInt(scat.shopId),
                  name: scat.name,
                  description: scat.description,
                  imageUrl: scat.imageUrl,
                  syncedAt: new Date().toISOString(),
                  productCount: scat.productCount,
                });
              } else {
                await db.categories.add({
                  uuid: scat.uuid,
                  shopId: parseInt(scat.shopId),
                  name: scat.name,
                  description: scat.description,
                  imageUrl: scat.imageUrl,
                  syncedAt: new Date().toISOString(),
                  productCount: scat.productCount,
                });
              }
            }

            // Clean up old synced categories that are no longer on the server
            const serverUuids = new Set(serverCats.map((c) => c.uuid));
            const allLocal = await db.categories.toArray();
            for (const lcat of allLocal) {
              if (lcat.syncedAt !== null && !serverUuids.has(lcat.uuid)) {
                await db.categories.delete(lcat.id!);
              }
            }
          });

          // Reload from IndexedDB to show updated state
          const updatedLocal = await db.categories.toArray();
          setCategories(
            updatedLocal.map((cat) => ({
              id: cat.id?.toString() ?? '',
              uuid: cat.uuid,
              shopId: cat.shopId.toString(),
              name: cat.name,
              description: cat.description,
              imageUrl: cat.imageUrl,
              productCount: cat.productCount ?? 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }))
          );
        } catch (err: unknown) {
          console.warn('[Categories] Failed to sync with backend:', getErrorMessage(err));
        }
      }
    } catch (error: unknown) {
      toast.error('Failed to load categories');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ─── Delete Handler ────────────────────────────────────────────────────────

  const handleDelete = async (category: CategoryResponse) => {
    if (confirmDeleteId !== category.uuid) {
      // First click: arm the confirmation
      setConfirmDeleteId(category.uuid);
      return;
    }

    // Second click: execute delete
    try {
      const db = getDb();
      
      // Inline check for product count to fail fast client-side
      if (category.productCount > 0) {
        toast.error('Cannot delete a category that has products. Reassign or delete the products first.');
        setConfirmDeleteId(null);
        return;
      }

      // 1. Optimistic delete from IndexedDB
      await db.categories.where('uuid').equals(category.uuid).delete();

      // 2. Queue to sync engine
      await syncEngine.enqueue('categories', 'DELETE', {
        id: category.id ? parseInt(category.id) : undefined,
        uuid: category.uuid,
      });



      toast.success('Category deleted successfully');
      setConfirmDeleteId(null);
      loadCategories();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to delete category');
    }
  };

  const handleEditClick = (category: CategoryResponse) => {
    setEditingCategory(category);
    setIsSheetOpen(true);
  };

  const handleAddClick = () => {
    setEditingCategory(undefined);
    setIsSheetOpen(true);
  };

  const handleSheetSuccess = () => {
    setIsSheetOpen(false);
    loadCategories();
  };

  // Reset delete confirmation on clicking outside
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
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" onClick={() => setConfirmDeleteId(null)}>
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1">
            Organize and classify products in your store catalogue.
          </p>
        </div>
        <Button onClick={handleAddClick} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      {/* Main Categories Table or Empty State */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 p-12 text-center bg-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Folder className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No categories yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Add your first category to start organizing your product catalogue.
          </p>
          <Button onClick={handleAddClick} variant="outline" className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32 text-center">Products</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.uuid} className="hover:bg-muted/10 transition-colors">
                  {/* Category Image */}
                  <TableCell>
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt={category.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </div>
                  </TableCell>

                  {/* Name */}
                  <TableCell className="font-medium text-foreground">
                    {category.name}
                  </TableCell>

                  {/* Description */}
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {category.description || '—'}
                  </TableCell>

                  {/* Product Count */}
                  <TableCell className="text-center font-semibold">
                    {category.productCount}
                  </TableCell>

                  {/* Actions (Edit / Confirm Delete) */}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditClick(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant={confirmDeleteId === category.uuid ? 'destructive' : 'ghost'}
                        onClick={() => handleDelete(category)}
                        className="min-w-[80px]"
                      >
                        {confirmDeleteId === category.uuid ? (
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

      {/* Slide-out Sheet (Create / Edit Form) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md w-full bg-card overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </SheetTitle>
            <SheetDescription>
              {editingCategory
                ? 'Make changes to your category fields below.'
                : 'Create a new category to group related items.'}
            </SheetDescription>
          </SheetHeader>
          <CategoryForm
            category={editingCategory}
            onSuccess={handleSheetSuccess}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
