/**
 * Firestore Security Rules Test Suite — MyWardrobe AI
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  docId?: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const dirtyDozenTests: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Wardrobe Creation',
    collection: 'wardrobeItems',
    operation: 'create',
    auth: { uid: 'attacker_uid_111', email_verified: true },
    docId: 'item_1',
    payload: {
      itemId: 'item_1',
      userId: 'victim_uid_999',
      name: 'Spoofed Shirt',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write Attempt',
    collection: 'users',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    docId: 'user_1',
    payload: {
      userId: 'user_1',
      displayName: 'Unverified User',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Update',
    collection: 'wardrobeItems',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'item_1',
    payload: {
      isAdmin: true,
      role: 'superuser',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-User Wardrobe List Scraping',
    collection: 'wardrobeItems',
    operation: 'list',
    auth: { uid: 'attacker_uid_111', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-User Profile Read',
    collection: 'users',
    operation: 'get',
    auth: { uid: 'attacker_uid_111', email_verified: true },
    docId: 'victim_uid_999',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning Attack',
    collection: 'wardrobeItems',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'invalid$id!with spaces',
    payload: { itemId: 'invalid$id!with spaces', userId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Create',
    collection: 'outfits',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'outfit_1',
    payload: {
      outfitId: 'outfit_1',
      userId: 'user_1',
      createdAt: '2000-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation on Update',
    collection: 'outfits',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'outfit_1',
    payload: {
      userId: 'other_user',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Denial-of-Wallet Oversized Notes Field',
    collection: 'wardrobeItems',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'item_2',
    payload: {
      itemId: 'item_2',
      userId: 'user_1',
      notes: 'x'.repeat(2000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Usage Count Update',
    collection: 'wardrobeItems',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'item_1',
    payload: {
      usageCount: -999,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Orphaned Feedback Creation',
    collection: 'feedback',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'fb_1',
    payload: {
      feedbackId: 'fb_1',
      userId: 'user_1',
      outfitId: 'non_existent_outfit_999',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Feedback Mutation Attempt',
    collection: 'feedback',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'fb_1',
    payload: {
      rating: 'love',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
