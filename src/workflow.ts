// src/workflow.ts
import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import OpenAI from 'openai';
import RssParser from 'rss-parser';

console.log('Workflow script started...');

// 1. --- INITIALIZE SERVICES ---

// Initialize OpenAI client using environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const articlesCollection = collection(db, 'articles');

const parser = new RssParser();

// We will add more code below... 