// frontend/components/dashboard/category-form.tsx
// Purpose: Reusable create/edit form for categories, used in the slide-in Sheet.

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/dashboard/image-upload';
import { syncEngine } from '@/lib/sync/sync-engine';
import { getDb } from '@/lib/db/dexie';
import { getErrorMessage, generateUUID } from '@/lib/utils';
import type { CategoryResponse } from '@/types/api';

// ─── Schema ──────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(1000).optional().or(z.literal('')),
  image_url:   z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryFormProps {
  category?: CategoryResponse;   // undefined = create mode, defined = edit mode
  onSuccess: () => void;         // close sheet + refresh list
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const isEditMode = category !== undefined;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name:        category?.name        ?? '',
      description: category?.description ?? '',
      image_url:   category?.imageUrl    ?? '',
    },
  });

  // Re-populate form when category prop changes (sheet re-use)
  useEffect(() => {
    if (category) {
      form.reset({
        name:        category.name,
        description: category.description ?? '',
        image_url:   category.imageUrl    ?? '',
      });
    } else {
      form.reset({ name: '', description: '', image_url: '' });
    }
  }, [category, form]);

  const imageUrls = form.watch('image_url') ? [form.watch('image_url') as string] : [];

  const handleImageChange = (urls: string[]) => {
    form.setValue('image_url', urls[0] ?? '');
  };

  const handleImageRemove = () => {
    form.setValue('image_url', '');
  };

  const onSubmit = async (values: CategoryFormValues) => {
    const db = getDb();

    try {
      if (isEditMode && category) {
        // ── Edit mode — update IndexedDB immediately ──
        await db.categories.where('uuid').equals(category.uuid).modify({
          name:        values.name,
          description: values.description || null,
          imageUrl:    values.image_url   || null,
        });

        // Enqueue to sync engine
        await syncEngine.enqueue('category', 'UPDATE', {
          id:          category.id,
          uuid:        category.uuid,
          name:        values.name,
          description: values.description || null,
          image_url:   values.image_url   || null,
        });
      } else {
        // ── Create mode — write to IndexedDB immediately ──
        const localUuid = generateUUID();

        await db.categories.add({
          uuid:        localUuid,
          shopId:      0,       // will be corrected on sync
          name:        values.name,
          description: values.description || null,
          imageUrl:    values.image_url   || null,
          syncedAt:    null,
        });

        // Enqueue to sync engine
        await syncEngine.enqueue('category', 'CREATE', {
          uuid:        localUuid,
          name:        values.name,
          description: values.description || null,
          image_url:   values.image_url   || null,
        });
      }

      toast.success('Category saved');
      onSuccess();
    } catch (error: unknown) {
      console.error('[CategoryForm] Save error:', error);
      toast.error(getErrorMessage(error) || 'Failed to save category.');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. Beverages" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional description…"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image */}
        <FormField
          control={form.control}
          name="image_url"
          render={() => (
            <FormItem>
              <FormLabel>Category Image</FormLabel>
              <FormControl>
                <ImageUpload
                  value={imageUrls}
                  onChange={handleImageChange}
                  onRemove={handleImageRemove}
                  folder="smartkiosk/categories"
                  maxImages={1}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSuccess}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? 'Saving…'
              : isEditMode
                ? 'Update Category'
                : 'Add Category'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
