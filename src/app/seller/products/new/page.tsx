import { ProductForm } from "@/components/forms/ProductForm";

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Add product</h1>
      <div className="card p-6">
        <ProductForm mode="create" />
      </div>
    </div>
  );
}
