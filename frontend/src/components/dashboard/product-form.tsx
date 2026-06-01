// frontend/src/components/dashboard/product-form.tsx
// Purpose: Multi-step product wizard form with barcode scanner,
//          live completeness score tracker, and offline-first IndexedDB write pipeline.

'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ImageUpload } from '@/components/dashboard/image-upload';
import { BarcodeScanner } from '@/components/dashboard/barcode-scanner';
import { getDb } from '@/lib/db/dexie';
import { syncEngine } from '@/lib/sync/sync-engine';
import { computeCompleteness } from '@/lib/product-completeness';
import { getErrorMessage } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type { ProductResponse, CategoryResponse, SupplierResponse } from '@/types/api';

// ─── Schema ──────────────────────────────────────────────────────────────────

const toNum = (val: unknown) => (val === '' || val === null || val === undefined ? 0 : Number(val));

const productSchema = z.object({
  name:          z.string().min(2, 'Name must be at least 2 characters').max(150),
  sku:           z.string().max(50).optional().or(z.literal('')),
  barcode:       z.string().max(50).optional().or(z.literal('')),
  category_id:   z.string().optional().or(z.literal('')),
  supplier_id:   z.string().optional().or(z.literal('')),
  buying_price:  z.preprocess(toNum, z.number().min(0, 'Buying price must be positive')),
  selling_price: z.preprocess(toNum, z.number().min(0, 'Selling price must be positive')),
  quantity:      z.preprocess(toNum, z.number().min(0, 'Quantity must be positive')),
  reorder_level: z.preprocess(toNum, z.number().min(0, 'Reorder level must be positive')),
  unit:          z.enum(['piece', 'kg', 'litre', 'pack']),
  expiry_date:   z.string().optional().or(z.literal('')),
  image_url:     z.string().optional().or(z.literal('')),
  is_active:     z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  product?: ProductResponse;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const isEditMode = product !== undefined;
  const [step, setStep] = useState(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Lists for dropdown options
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);

  const form = useForm<ProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name:          product?.name          ?? '',
      sku:           product?.sku           ?? '',
      barcode:       product?.barcode       ?? '',
      category_id:   product?.categoryId    ?? '',
      supplier_id:   product?.supplierId    ?? '',
      buying_price:  product?.buyingPrice   ?? 0,
      selling_price: product?.sellingPrice  ?? 0,
      quantity:      product?.quantity      ?? 0,
      reorder_level: product?.reorderLevel  ?? 5,
      unit:          product?.unit          ?? 'piece',
      expiry_date:   product?.expiryDate    ?? '',
      image_url:     product?.imageUrl      ?? '',
      is_active:     product?.isActive      ?? true,
    },
  });

  // Fetch categories & suppliers from local Dexie database (offline-first)
  useEffect(() => {
    const loadDropdownData = async () => {
      const db = getDb();
      const localCats = await db.categories.toArray();
      const localSups = await db.suppliers.toArray();

      setCategories(
        localCats.map((cat) => ({
          id: cat.id?.toString() ?? '',
          uuid: cat.uuid,
          shopId: cat.shopId.toString(),
          name: cat.name,
          description: cat.description,
          imageUrl: cat.imageUrl,
          productCount: 0,
          createdAt: '',
          updatedAt: '',
        }))
      );

      setSuppliers(
        localSups.map((sup) => ({
          id: sup.id?.toString() ?? '',
          uuid: sup.uuid,
          shopId: sup.shopId.toString(),
          name: sup.name,
          phone: sup.phone,
          email: sup.email,
          address: sup.address,
          notes: sup.notes,
          productCount: 0,
          stockMovementCount: 0,
          createdAt: '',
          updatedAt: '',
        }))
      );
    };

    loadDropdownData();
  }, []);

  // ── Calculate Live Completeness Score ──────────────────────────────────────

  const watchedValues = form.watch();
  const completenessInput: ProductResponse = {
    id: product?.id ?? '',
    uuid: product?.uuid ?? '',
    shopId: product?.shopId ?? '',
    categoryId: watchedValues.category_id || null,
    supplierId: watchedValues.supplier_id || null,
    name: watchedValues.name,
    sku: watchedValues.sku || null,
    barcode: watchedValues.barcode || null,
    buyingPrice: watchedValues.buying_price ?? 0,
    sellingPrice: watchedValues.selling_price ?? 0,
    quantity: watchedValues.quantity ?? 0,
    reorderLevel: watchedValues.reorder_level ?? 5,
    unit: watchedValues.unit ?? 'piece',
    expiryDate: watchedValues.expiry_date || null,
    imageUrl: watchedValues.image_url || null,
    isActive: watchedValues.is_active ?? true,
    category: watchedValues.category_id ? { id: watchedValues.category_id, name: '' } : null,
    createdAt: '',
    updatedAt: '',
  };

  const { score, missing } = computeCompleteness(completenessInput);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBarcodeScanned = (barcode: string) => {
    form.setValue('barcode', barcode);
    setIsScannerOpen(false);
  };

  const nextStep = async () => {
    // Validate current step fields before progressing
    let fieldsToValidate: Array<keyof ProductFormValues> = [];
    if (step === 1) {
      fieldsToValidate = ['name', 'sku', 'barcode', 'category_id', 'supplier_id'];
    } else if (step === 2) {
      fieldsToValidate = ['buying_price', 'selling_price', 'quantity', 'reorder_level', 'unit'];
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = async (values: ProductFormValues) => {
    // Check price bounds
    if (values.selling_price < values.buying_price) {
      form.setError('selling_price', {
        type: 'manual',
        message: 'Selling price must be greater than or equal to buying price.',
      });
      setStep(2);
      return;
    }

    const db = getDb();

    try {
      if (isEditMode && product) {
        // ── UPDATE Product in Dexie IndexedDB ──
        await db.products.where('uuid').equals(product.uuid).modify({
          categoryId: values.category_id ? parseInt(values.category_id) : null,
          supplierId: values.supplier_id ? parseInt(values.supplier_id) : null,
          name: values.name,
          sku: values.sku || null,
          barcode: values.barcode || null,
          buyingPrice: values.buying_price,
          sellingPrice: values.selling_price,
          quantity: values.quantity,
          reorderLevel: values.reorder_level,
          unit: values.unit,
          expiryDate: values.expiry_date || null,
          imageUrl: values.image_url || null,
          isActive: values.is_active,
        });

        // Queue update in SyncEngine
        await syncEngine.enqueue('products', 'UPDATE', {
          id: parseInt(product.id),
          uuid: product.uuid,
          category_id: values.category_id ? parseInt(values.category_id) : null,
          supplier_id: values.supplier_id ? parseInt(values.supplier_id) : null,
          name: values.name,
          sku: values.sku || null,
          barcode: values.barcode || null,
          buying_price: values.buying_price,
          selling_price: values.selling_price,
          quantity: values.quantity,
          reorder_level: values.reorder_level,
          unit: values.unit,
          expiry_date: values.expiry_date || null,
          image_url: values.image_url || null,
          is_active: values.is_active,
        });


      } else {
        // ── CREATE Product in Dexie IndexedDB ──
        const { nanoid } = await import('nanoid');
        const localUuid = nanoid();

        await db.products.add({
          uuid: localUuid,
          shopId: 0,
          categoryId: values.category_id ? parseInt(values.category_id) : null,
          supplierId: values.supplier_id ? parseInt(values.supplier_id) : null,
          name: values.name,
          sku: values.sku || null,
          barcode: values.barcode || null,
          buyingPrice: values.buying_price,
          sellingPrice: values.selling_price,
          quantity: values.quantity,
          reorderLevel: values.reorder_level,
          unit: values.unit,
          expiryDate: values.expiry_date || null,
          imageUrl: values.image_url || null,
          isActive: values.is_active,
          syncedAt: null,
        });

        // Queue creation in SyncEngine
        await syncEngine.enqueue('products', 'CREATE', {
          uuid: localUuid,
          category_id: values.category_id ? parseInt(values.category_id) : null,
          supplier_id: values.supplier_id ? parseInt(values.supplier_id) : null,
          name: values.name,
          sku: values.sku || null,
          barcode: values.barcode || null,
          buying_price: values.buying_price,
          selling_price: values.selling_price,
          quantity: values.quantity,
          reorder_level: values.reorder_level,
          unit: values.unit,
          expiry_date: values.expiry_date || null,
          image_url: values.image_url || null,
          is_active: values.is_active,
        });


      }

      toast.success('Product saved successfully');
      onSuccess();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to save product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Wizard Info & Progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Step {step} of 3</span>
          <span>{step === 1 ? 'Basic Details' : step === 2 ? 'Pricing & Stock' : 'Media & Settings'}</span>
        </div>
        <Progress value={(step / 3) * 100} className="h-2 rounded-full" />
      </div>

      {/* Live Catalog Completeness Tracker Widget */}
      <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3 shadow-xs">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            Catalogue Health
          </span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
            score >= 80 ? 'bg-green-500/10 text-green-600' : score >= 50 ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive'
          }`}>
            {score}% Complete
          </span>
        </div>
        <Progress value={score} className="h-1.5 bg-muted" />
        
        {/* Render Missing Fields Checklist */}
        {missing.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Suggestions to Improve Health:</span>
            <ul className="text-xs space-y-1 text-muted-foreground">
              {missing.slice(0, 3).map((hint, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>{hint.label} (+{hint.points}%)</span>
                </li>
              ))}
              {missing.length > 3 && (
                <li className="text-[10px] italic text-muted-foreground/80 pl-3">
                  + {missing.length - 3} more suggestions
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) {
              nextStep();
            } else {
              form.handleSubmit(onSubmit)(e);
            }
          }}
          className="space-y-5"
        >
          {/* STEP 1: Basic Details */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Soda Cans 300ml" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SKU */}
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BEV-SODA-300" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Barcode scanner slot */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="Scan or type barcode number" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setIsScannerOpen(!isScannerOpen)}
                        >
                          <Camera className="mr-1.5 h-4 w-4" /> Scan
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isScannerOpen && (
                  <div className="pt-2 flex justify-center">
                    <BarcodeScanner
                      onScan={handleBarcodeScanned}
                      onClose={() => setIsScannerOpen(false)}
                    />
                  </div>
                )}
              </div>

              {/* Category Dropdown */}
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Supplier Dropdown */}
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* STEP 2: Pricing & Stock */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              {/* Buying Price */}
              <FormField
                control={form.control}
                name="buying_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buying Price (KES) <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selling Price */}
              <FormField
                control={form.control}
                name="selling_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (KES) <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" disabled={isEditMode} {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reorder Level */}
              <FormField
                control={form.control}
                name="reorder_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level alert limit <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Measurement Unit */}
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="piece">Piece (pcs)</SelectItem>
                        <SelectItem value="kg">Kilogram (kg)</SelectItem>
                        <SelectItem value="litre">Litre (l)</SelectItem>
                        <SelectItem value="pack">Pack</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* STEP 3: Optional Media & Settings */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              {/* Product Expiry Date */}
              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Product Image */}
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Image</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={watchedValues.image_url ? [watchedValues.image_url] : []}
                        onChange={(urls) => form.setValue('image_url', urls[0] ?? '')}
                        onRemove={() => form.setValue('image_url', '')}
                        folder="smartkiosk/products"
                        maxImages={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active Switch */}
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-semibold">Active Status</FormLabel>
                      <p className="text-xs text-muted-foreground">Enabled items appear in POS scanning</p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>

            {step < 3 ? (
              <Button type="button" onClick={nextStep} className="shadow-sm">
                Next <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={form.formState.isSubmitting} className="shadow-md">
                {form.formState.isSubmitting ? (
                  'Saving Product...'
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> {isEditMode ? 'Update Catalog' : 'Publish Product'}
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
