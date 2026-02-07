/** Broad category of resource */
export type ResourceCategory =
  | 'raw'
  | 'food'
  | 'material'
  | 'processed'
  | 'luxury'
  | 'military';

/** How a resource must be stored */
export type StorageType = 'none' | 'dry' | 'cold' | 'secure';

/** Static definition of a resource type */
export interface ResourceDefinition {
  id: string;
  name: string;
  category: ResourceCategory;
  baseValue: number;          // gold per unit
  weight: number;             // affects transport capacity
  spoilRate: number;          // fraction lost per turn; 0 = never spoils
  stackSize: number;          // max units per stack
  storageRequirement: StorageType;
  description: string;
}

/** An actual stack of a resource in the world */
export interface ResourceStack {
  resourceId: string;
  quantity: number;
  quality: number;            // 0–1 (affects value & effectiveness)
  age: number;                // turns since produced
  ownerId?: string;           // character or location that owns this
}
