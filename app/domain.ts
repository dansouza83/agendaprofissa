export type Status = "confirmado" | "pendente" | "concluido" | "cancelado";
export type Client = { id: string; tenantId: string; name: string; phone: string; email: string; notes: string };
export type Service = { id: string; tenantId: string; name: string; duration: number; price: number; color: string; active: boolean };
export type Appointment = { id: string; tenantId: string; clientId: string; serviceId: string; date: string; time: string; status: Status; notes: string; paymentStatus?: "paid" | "pending" };
export type WorkspaceData = { clients: Client[]; services: Service[]; appointments: Appointment[] };
export type Identity = { name: string; business: string; email: string; initials: string; role?: string };
