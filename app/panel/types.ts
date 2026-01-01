// app/panel/types.ts
import { Timestamp } from "firebase/firestore";

export interface UserData {
  email: string;
  role: string;
  uid?: string;
}

export interface DoorprizeParticipant {
  id: string;
  name: string;
}

export interface DoorprizeWinner {
  id: string;
  name: string;
  wonAt?: Timestamp;
  prizeName?: string;
}

export interface AwardNominee {
  id: string;
  name: string;
  company: string;
}

export interface AwardWinnerSlot {
  id: string;
  rank: number;
  candidateId: string;
  category: string;
  eventLabel?: string;
}

export interface Prize {
  id: string;
  name: string;
  stock: number;
  image_url?: string;
  price?: number; 
  isGrandPrize?: boolean;
}

export interface ArchivedSession {
  id: string;
  archivedAt: Timestamp;
  label: string;
}

export interface AwardWinnerHistory {
  id?: string;
  name: string;
  company: string;
  rank: number;
  category: string;
  eventLabel?: string;
  title?: string;
}

export type TabType = "dashboard" | "doorprize" | "award-nominees" | "awards" | "prizes" | "recap";