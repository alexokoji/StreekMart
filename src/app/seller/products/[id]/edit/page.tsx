import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { ProductForm } from "@/components/forms/ProductForm";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const user = await requireUser("SELLER");
  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product || product.sellerId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <div className="card p-6">
        <ProductForm
          mode="edit"
          initial={{
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            salePrice: product.salePrice,
            stock: product.stock,
            unit: product.unit,
            category: product.category,
            status: product.status,
            images: parseJsonArray(product.imagesJson),
          }}
        />
      </div>
    </div>
  );
}
