export type AdminEvent = {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  venue: string;
  published: boolean;
};

export type AdminCategory = {
  id: string;
  eventId: string;
  name: string;
  price: number;
  capacity: number;
  held: number;
  salesOpen: boolean;
};

export type PublicEventSummary = { slug: string; name: string; startsAt: string; venue: string };

export type PublicCategory = {
  id: string;
  name: string;
  price: number;
  capacity: number;
  available: number;
  salesOpen: boolean;
};

export type PublicEvent = PublicEventSummary & { categories: PublicCategory[] };

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'payment_review';

export type Order = {
  id: string;
  status: OrderStatus;
  eventName: string;
  eventSlug: string;
  eventStartsAt: string;
  categoryName: string;
  participantName: string;
  amount: number;
  paymentDeadline: string;
  holdReleased: boolean;
  payment: { redirectUrl: string } | null;
  createdAt: string;
};

export type Ticket = {
  id: string;
  orderId: string;
  lookupCode: string;
  checkedInAt: string | null;
  participantName: string;
  categoryName: string;
  eventName: string;
  eventStartsAt: string;
  venue: string;
};
