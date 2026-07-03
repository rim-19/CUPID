export type Roast = 'Light' | 'Med' | 'Dark';
export type Pace = 'slow' | 'medium' | 'fast';
export type Ending = 'bittersweet' | 'hopeful' | 'open';

export interface Book {
  id?: string;
  title: string;
  author: string;
  rating: string;
  price: string;
  tint: string;
  lang: string;
  roast: Roast;
  notes: string;
  genre?: string;
  mood?: string[];
  pace?: Pace;
  ending?: Ending;
  stock?: number;
  summary?: string;
  pages?: number;
  year?: number;
  reviews?: number;
  custom?: boolean;
}

export interface CartLine {
  bookId?: string;
  title: string;
  price: string;
  qty: number;
}

export interface StoreState {
  cart: CartLine[];
  wishlist: string[];
}
