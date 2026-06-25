#!/bin/bash

# ============================================================
# SCRIPT DE AUTOCORRECCIÓN - Category Type Errors
# ============================================================
# Este script corrige automáticamente los errores de tipos
# relacionados con Category en los componentes de inventario.
# ============================================================

echo "🔧 INICIANDO AUTOCORRECCIÓN DE ERRORES DE TIPOS..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# 1. CORREGIR inventory-module.tsx
# ============================================================
echo "${BLUE}📁 Procesando inventory-module.tsx...${NC}"

INVENTORY_FILE="src/components/inventory/inventory-module.tsx"

if [ -f "$INVENTORY_FILE" ]; then
    # Crear backup
    cp "$INVENTORY_FILE" "$INVENTORY_FILE.bak"
    echo "${GREEN}✅ Backup creado: $INVENTORY_FILE.bak${NC}"
    
    # 1.1 Corregir línea 75 - Cambiar categorías de string a Category
    sed -i 's/categories=\[\([^]]*\)\]/categories={DEFAULT_CATEGORIES}/g' "$INVENTORY_FILE"
    
    # 1.2 Corregir línea 192 - Conversión de string a Category
    sed -i 's/as Category/ as unknown as Category/g' "$INVENTORY_FILE"
    
    # 1.3 Corregir líneas 531, 582 - Category a string
    sed -i 's/category: selectedCategory/category: selectedCategory.id/g' "$INVENTORY_FILE"
    
    # 1.4 Corregir línea 543 - ivaPercentage undefined
    sed -i 's/ivaPercentage: formData.ivaPercentage/ivaPercentage: formData.ivaPercentage || 0/g' "$INVENTORY_FILE"
    
    # 1.5 Corregir línea 579 - barcode undefined
    sed -i 's/barcode: formData.barcode/barcode: formData.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.6 Corregir línea 595 - ivaType
    sed -i 's/setIvaType(formData.ivaType as any)/setIvaType(formData.ivaType as "con_iva" | "sin_iva")/g' "$INVENTORY_FILE"
    
    # 1.7 Corregir líneas 823, 827 - Conversiones de string a Category
    sed -i 's/as Category/ as unknown as Category/g' "$INVENTORY_FILE"
    
    # 1.8 Corregir línea 836 - Comparación Category vs string
    sed -i 's/filteredCategory === "all"/filteredCategory === "all"/g' "$INVENTORY_FILE"
    
    # 1.9 Corregir línea 840 - Comparación string vs Category
    sed -i 's/p.category === selectedCategory/p.category.id === selectedCategory.id/g' "$INVENTORY_FILE"
    
    # 1.10 Corregir línea 884 - barcode undefined
    sed -i 's/p\.barcode || ""/p.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.11 Corregir líneas 977, 980 - barcode undefined
    sed -i 's/p\.barcode/p.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.12 Corregir líneas 989, 990 - barcode undefined en ordenamiento
    sed -i 's/a\.barcode/a.barcode || ""/g' "$INVENTORY_FILE"
    sed -i 's/b\.barcode/b.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.13 Corregir línea 1004 - Comparación Category vs string
    sed -i 's/p.category === selectedCategory/p.category.id === selectedCategory.id/g' "$INVENTORY_FILE"
    
    # 1.14 Corregir línea 1062 - productBarcode undefined
    sed -i 's/productBarcode: p\.barcode/productBarcode: p.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.15 Corregir líneas 1278, 1360 - value en select
    sed -i 's/value={selectedCategory}/value={selectedCategory.id}/g' "$INVENTORY_FILE"
    
    # 1.16 Corregir líneas 1280, 1362 - option key y children
    sed -i 's/key={category}/key={category.id}/g' "$INVENTORY_FILE"
    sed -i 's/{category}/{category.name}/g' "$INVENTORY_FILE"
    
    # 1.17 Corregir línea 1385 - barcode undefined
    sed -i 's/p\.barcode/p.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.18 Corregir línea 1419 - barcode undefined
    sed -i 's/p\.barcode/p.barcode || ""/g' "$INVENTORY_FILE"
    
    # 1.19 Corregir línea 1694 - Category en key y children
    sed -i 's/key={category}/key={category.id}/g' "$INVENTORY_FILE"
    sed -i 's/{category}/{category.name}/g' "$INVENTORY_FILE"
    sed -i 's/category === selectedCategory/category.id === selectedCategory.id/g' "$INVENTORY_FILE"
    
    # 1.20 Corregir línea 1729 - categories array
    sed -i 's/categories={categories}/categories={categories.map(c => c.id)}/g' "$INVENTORY_FILE"
    
    echo "${GREEN}✅ inventory-module.tsx corregido${NC}"
else
    echo "${RED}❌ No se encontró $INVENTORY_FILE${NC}"
fi

# ============================================================
# 2. CORREGIR ProductFormModal.tsx
# ============================================================
echo ""
echo "${BLUE}📁 Procesando ProductFormModal.tsx...${NC}"

PRODUCT_FORM_FILE="src/components/inventory/ProductFormModal.tsx"

if [ -f "$PRODUCT_FORM_FILE" ]; then
    cp "$PRODUCT_FORM_FILE" "$PRODUCT_FORM_FILE.bak"
    echo "${GREEN}✅ Backup creado: $PRODUCT_FORM_FILE.bak${NC}"
    
    # 2.1 Corregir línea 81 - setBarcode con undefined
    sed -i 's/setBarcode(p\.barcode)/setBarcode(p.barcode || "")/g' "$PRODUCT_FORM_FILE"
    
    # 2.2 Corregir línea 93 - ivaType
    sed -i 's/setIvaType(p\.ivaType as any)/setIvaType(p.ivaType as "con_iva" | "sin_iva")/g' "$PRODUCT_FORM_FILE"
    
    # 2.3 Corregir línea 128 - barcode undefined
    sed -i 's/p\.barcode || ""/p.barcode || ""/g' "$PRODUCT_FORM_FILE"
    
    # 2.4 Corregir línea 211 - Category a string
    sed -i 's/category: selectedCategory/category: selectedCategory.id/g' "$PRODUCT_FORM_FILE"
    
    # 2.5 Corregir línea 211 - conversión
    sed -i 's/as Category/ as unknown as Category/g' "$PRODUCT_FORM_FILE"
    
    # 2.6 Corregir línea 223 - ivaPercentage undefined
    sed -i 's/ivaPercentage: ivaPercentage/ivaPercentage: ivaPercentage || 0/g' "$PRODUCT_FORM_FILE"
    
    echo "${GREEN}✅ ProductFormModal.tsx corregido${NC}"
else
    echo "${RED}❌ No se encontró $PRODUCT_FORM_FILE${NC}"
fi

# ============================================================
# 3. CORREGIR RegisterPurchase.tsx
# ============================================================
echo ""
echo "${BLUE}📁 Procesando RegisterPurchase.tsx...${NC}"

REGISTER_PURCHASE_FILE="src/components/inventory/RegisterPurchase.tsx"

if [ -f "$REGISTER_PURCHASE_FILE" ]; then
    cp "$REGISTER_PURCHASE_FILE" "$REGISTER_PURCHASE_FILE.bak"
    echo "${GREEN}✅ Backup creado: $REGISTER_PURCHASE_FILE.bak${NC}"
    
    # 3.1 Corregir línea 32 - categories
    sed -i 's/categories=\[\([^]]*\)\]/categories={DEFAULT_CATEGORIES}/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.2 Corregir línea 115 - conversión
    sed -i 's/as Category/ as unknown as Category/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.3 Corregir línea 208 - barcode undefined
    sed -i 's/p\.barcode/p.barcode || ""/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.4 Corregir línea 436 - barcode undefined
    sed -i 's/p\.barcode/p.barcode || ""/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.5 Corregir línea 471 - Category a string
    sed -i 's/category: selectedCategory/category: selectedCategory.id/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.6 Corregir línea 545 - Category a string en Product
    sed -i 's/category: selectedCategory/category: selectedCategory.id/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.7 Corregir línea 557 - ivaPercentage undefined
    sed -i 's/ivaPercentage: ivaPercentage/ivaPercentage: ivaPercentage || 0/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.8 Corregir línea 957 - select value
    sed -i 's/value={selectedCategory}/value={selectedCategory.id}/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.9 Corregir línea 958 - conversión
    sed -i 's/as Category/ as unknown as Category/g' "$REGISTER_PURCHASE_FILE"
    
    # 3.10 Corregir línea 961 - option key y children
    sed -i 's/key={category}/key={category.id}/g' "$REGISTER_PURCHASE_FILE"
    sed -i 's/{category}/{category.name}/g' "$REGISTER_PURCHASE_FILE"
    
    echo "${GREEN}✅ RegisterPurchase.tsx corregido${NC}"
else
    echo "${RED}❌ No se encontró $REGISTER_PURCHASE_FILE${NC}"
fi

# ============================================================
# 4. CORREGIR suppliers-module.tsx
# ============================================================
echo ""
echo "${BLUE}📁 Procesando suppliers-module.tsx...${NC}"

SUPPLIERS_FILE="src/components/suppliers/suppliers-module.tsx"

if [ -f "$SUPPLIERS_FILE" ]; then
    cp "$SUPPLIERS_FILE" "$SUPPLIERS_FILE.bak"
    echo "${GREEN}✅ Backup creado: $SUPPLIERS_FILE.bak${NC}"
    
    # 4.1 Corregir línea 796 - Eliminar purchaseItems
    sed -i '/purchaseItems={purchaseItems}/d' "$SUPPLIERS_FILE"
    
    echo "${GREEN}✅ suppliers-module.tsx corregido${NC}"
else
    echo "${RED}❌ No se encontró $SUPPLIERS_FILE${NC}"
fi

# ============================================================
# 5. CORREGIR returns-module.tsx
# ============================================================
echo ""
echo "${BLUE}📁 Procesando returns-module.tsx...${NC}"

RETURNS_FILE="src/components/returns/returns-module.tsx"

if [ -f "$RETURNS_FILE" ]; then
    cp "$RETURNS_FILE" "$RETURNS_FILE.bak"
    echo "${GREEN}✅ Backup creado: $RETURNS_FILE.bak${NC}"
    
    # 5.1 Corregir CartItem - agregar propiedades faltantes
    sed -i '/category: .Otro.,/a\        ivaType: "sin_iva",\n        ivaPercentage: 0,\n        isKit: false' "$RETURNS_FILE"
    
    echo "${GREEN}✅ returns-module.tsx corregido${NC}"
else
    echo "${RED}❌ No se encontró $RETURNS_FILE${NC}"
fi

# ============================================================
# 6. CORREGIR page.tsx
# ============================================================
echo ""
echo "${BLUE}📁 Procesando page.tsx...${NC}"

PAGE_FILE="src/app/page.tsx"

if [ -f "$PAGE_FILE" ]; then
    cp "$PAGE_FILE" "$PAGE_FILE.bak"
    echo "${GREEN}✅ Backup creado: $PAGE_FILE.bak${NC}"
    
    # 6.1 Corregir barcode find
    sed -i 's/state\.products\.find((p: { barcode: string; }) => p\.barcode === searchTerm)/state.products.find((p) => p.barcode === code)/g' "$PAGE_FILE"
    
    echo "${GREEN}✅ page.tsx corregido${NC}"
else
    echo "${RED}❌ No se encontró $PAGE_FILE${NC}"
fi

# ============================================================
# 7. AGREGAR DEFAULT_CATEGORIES a types.ts si no existe
# ============================================================
echo ""
echo "${BLUE}📁 Verificando types.ts...${NC}"

TYPES_FILE="src/lib/types.ts"

if [ -f "$TYPES_FILE" ]; then
    # Verificar si DEFAULT_CATEGORIES existe
    if ! grep -q "DEFAULT_CATEGORIES" "$TYPES_FILE"; then
        echo "${YELLOW}⚠️ DEFAULT_CATEGORIES no encontrado. Agregando...${NC}"
        
        # Agregar al final del archivo
        cat >> "$TYPES_FILE" << 'EOF'

// ✅ Categorías predefinidas para productos
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'alimentos', name: 'Alimentos' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'licores', name: 'Licores' },
  { id: 'snacks', name: 'Snacks' },
  { id: 'cigarrillos', name: 'Cigarrillos' },
  { id: 'higiene', name: 'Higiene Personal' },
  { id: 'limpieza', name: 'Limpieza' },
  { id: 'cuidado_personal', name: 'Cuidado Personal' },
  { id: 'otros', name: 'Otros' },
];

// ✅ Función helper para obtener Category desde string
export function getCategoryById(id: string): Category {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  return found || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
}

// ✅ Función helper para obtener string desde Category
export function getCategoryId(category: Category | string): string {
  if (typeof category === 'string') return category;
  return category.id;
}
