import { ProductForm } from "@/components/forms/ProductForm";

export default function NewDesignerProductPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">List a new piece</h1>
      <p className="text-sm text-gray-600">Add a clothing item or accessory you want to sell. Use the AI assistant if you need help writing the description.</p>
      <div className="card p-6">
        <ProductForm mode="create" redirectBase="/designer/products" />
      </div>
    </div>
  );
}
