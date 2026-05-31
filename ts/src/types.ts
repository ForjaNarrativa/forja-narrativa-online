export type SitePage = {
  label: string;
  href: string;
  match: string[];
  public?: boolean;
};

export type ForjaPackage = {
  id: string;
  category: "principal";
  name: string;
  price: number;
  priceLabel: string;
  badge: string;
  short: string;
  idealFor: string;
  items: string[];
};

export type MemorialRank = {
  id: "chama" | "estatua" | "santuario" | "legado";
  name: string;
  price: number;
  priceLabel: string;
  region: string;
  limit: number;
  description: string;
  visual: string;
};

export type InternalPage = SitePage & {
  area: "admin" | "cliente" | "auth" | "legal";
  description: string;
};

export type OrderStatus =
  | "aguardando análise"
  | "aguardando pagamento"
  | "aguardando resposta do cliente"
  | "em produção"
  | "revisão solicitada"
  | "entregue"
  | "cancelado"
  | "arquivado"
  | "teste";

export type PaymentStatus = "não pago" | "pago" | "reembolsado" | "isento";
