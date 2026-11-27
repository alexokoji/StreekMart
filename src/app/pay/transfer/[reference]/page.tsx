import TransferClient from "./TransferClient";

export const dynamic = "force-dynamic";

export default function TransferPage({ params }: { params: { reference: string } }) {
  return <TransferClient reference={params.reference} />;
}
