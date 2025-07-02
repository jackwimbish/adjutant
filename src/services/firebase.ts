import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { UserConfig } from '../config/user-config';

export function initializeFirebaseApp(firebaseConfig: UserConfig['firebase']): FirebaseApp {
  return initializeApp(firebaseConfig);
}

export function initializeFirestore(app: FirebaseApp): Firestore {
  return getFirestore(app);
} 