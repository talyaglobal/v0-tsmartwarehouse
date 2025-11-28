// Standard Operating Procedures (SOP) Templates
// Workflow templates for warehouse operations

export type SOPCategory = "receiving" | "storage" | "picking" | "shipping" | "safety" | "maintenance" | "incident"

export interface SOPStep {
  id: string
  order: number
  title: string
  description: string
  requiredRole?: string
  estimatedMinutes: number
  checklistItems: string[]
  warningNotes?: string[]
  requiresApproval?: boolean
  approverRole?: string
}

export interface SOPTemplate {
  id: string
  name: string
  category: SOPCategory
  version: string
  description: string
  applicableTo: string[]
  steps: SOPStep[]
  safetyNotes: string[]
  requiredEquipment: string[]
  estimatedTotalMinutes: number
  lastUpdated: string
  approvedBy: string
}

export const sopTemplates: SOPTemplate[] = [
  {
    id: "sop-receiving-001",
    name: "Standard Receiving Procedure",
    category: "receiving",
    version: "2.1",
    description: "Standard procedure for receiving incoming shipments at the dock",
    applicableTo: ["all-warehouses"],
    estimatedTotalMinutes: 45,
    lastUpdated: "2025-01-15",
    approvedBy: "Operations Manager",
    requiredEquipment: ["Barcode scanner", "Pallet jack", "Clipboard/tablet", "PPE"],
    safetyNotes: [
      "Always wear safety vest and steel-toe boots",
      "Check dock leveler before unloading",
      "Report any damaged seals immediately",
    ],
    steps: [
      {
        id: "r1",
        order: 1,
        title: "Verify Delivery Documentation",
        description: "Check Bill of Lading (BOL) and compare with expected delivery schedule",
        estimatedMinutes: 5,
        checklistItems: [
          "BOL number matches system record",
          "Carrier information verified",
          "Seal number matches BOL (if applicable)",
          "Delivery appointment confirmed",
        ],
      },
      {
        id: "r2",
        order: 2,
        title: "Inspect Trailer/Container",
        description: "Perform visual inspection before opening",
        estimatedMinutes: 5,
        checklistItems: [
          "Check for visible damage to trailer",
          "Verify seal is intact",
          "Document seal number before breaking",
          "Take photos if damage observed",
        ],
        warningNotes: ["Do not accept delivery if seal is broken or tampered"],
      },
      {
        id: "r3",
        order: 3,
        title: "Unload and Count Items",
        description: "Systematically unload and verify item counts",
        estimatedMinutes: 20,
        checklistItems: [
          "Count pallets/units against BOL",
          "Check for visible damage during unloading",
          "Scan barcodes for each item",
          "Note any discrepancies immediately",
        ],
      },
      {
        id: "r4",
        order: 4,
        title: "Quality Inspection",
        description: "Perform quality check on received items",
        estimatedMinutes: 10,
        requiredRole: "quality_inspector",
        checklistItems: [
          "Random sample inspection (10% minimum)",
          "Check expiration dates if applicable",
          "Verify product specifications",
          "Document any quality issues",
        ],
        requiresApproval: true,
        approverRole: "supervisor",
      },
      {
        id: "r5",
        order: 5,
        title: "System Entry and Labeling",
        description: "Enter received items into WMS and apply location labels",
        estimatedMinutes: 5,
        checklistItems: [
          "Update WMS with received quantities",
          "Generate putaway labels",
          "Assign storage locations",
          "Complete receiving record",
        ],
      },
    ],
  },
  {
    id: "sop-incident-001",
    name: "Incident Reporting Procedure",
    category: "incident",
    version: "1.5",
    description: "Procedure for reporting and documenting warehouse incidents",
    applicableTo: ["all-warehouses"],
    estimatedTotalMinutes: 30,
    lastUpdated: "2025-01-10",
    approvedBy: "Safety Director",
    requiredEquipment: ["Camera/phone", "Incident report form", "First aid kit (if injury)"],
    safetyNotes: [
      "Ensure scene is safe before approaching",
      "Call emergency services if required",
      "Do not move items unless safety hazard exists",
    ],
    steps: [
      {
        id: "inc1",
        order: 1,
        title: "Secure the Scene",
        description: "Ensure safety and prevent further incidents",
        estimatedMinutes: 5,
        checklistItems: [
          "Assess immediate safety risks",
          "Clear area if necessary",
          "Administer first aid if injury (if trained)",
          "Call emergency services if needed",
        ],
        warningNotes: ["Personal safety is the top priority"],
      },
      {
        id: "inc2",
        order: 2,
        title: "Document the Incident",
        description: "Gather evidence and initial documentation",
        estimatedMinutes: 10,
        checklistItems: [
          "Take photographs from multiple angles",
          "Note date, time, and exact location",
          "Identify witnesses",
          "Preserve any physical evidence",
        ],
      },
      {
        id: "inc3",
        order: 3,
        title: "Notify Supervisor",
        description: "Report to immediate supervisor",
        estimatedMinutes: 5,
        checklistItems: [
          "Contact supervisor immediately",
          "Provide initial verbal report",
          "Follow escalation matrix if critical",
          "Document notification time",
        ],
        requiresApproval: true,
        approverRole: "supervisor",
      },
      {
        id: "inc4",
        order: 4,
        title: "Complete Incident Report",
        description: "Fill out formal incident report",
        estimatedMinutes: 10,
        checklistItems: [
          "Complete all required fields",
          "Attach photos and evidence",
          "Get witness statements",
          "Submit within 24 hours",
        ],
      },
    ],
  },
  {
    id: "sop-picking-001",
    name: "Order Picking Procedure",
    category: "picking",
    version: "2.0",
    description: "Standard procedure for picking customer orders",
    applicableTo: ["all-warehouses"],
    estimatedTotalMinutes: 25,
    lastUpdated: "2025-01-12",
    approvedBy: "Operations Manager",
    requiredEquipment: ["RF scanner", "Pick cart", "Packing materials", "Labels"],
    safetyNotes: ["Use proper lifting techniques", "Maintain clear aisles", "Report any unsafe conditions"],
    steps: [
      {
        id: "p1",
        order: 1,
        title: "Receive Pick Assignment",
        description: "Get pick task from WMS",
        estimatedMinutes: 2,
        checklistItems: ["Log into RF scanner", "Accept pick assignment", "Review order details", "Plan pick route"],
      },
      {
        id: "p2",
        order: 2,
        title: "Navigate to Location",
        description: "Travel to first pick location",
        estimatedMinutes: 5,
        checklistItems: [
          "Follow optimized route",
          "Verify location code",
          "Check product matches description",
          "Verify quantity available",
        ],
      },
      {
        id: "p3",
        order: 3,
        title: "Pick Items",
        description: "Retrieve items from storage",
        estimatedMinutes: 10,
        checklistItems: [
          "Scan location barcode",
          "Scan item barcode",
          "Pick correct quantity",
          "Check item condition",
          "Place in designated bin/cart",
        ],
        warningNotes: ["Never pick damaged items - report to supervisor"],
      },
      {
        id: "p4",
        order: 4,
        title: "Complete Pick",
        description: "Finalize the pick task",
        estimatedMinutes: 3,
        checklistItems: [
          "Verify all items picked",
          "Confirm quantities in scanner",
          "Transport to staging area",
          "Close pick task",
        ],
      },
      {
        id: "p5",
        order: 5,
        title: "Quality Check",
        description: "Verify pick accuracy",
        estimatedMinutes: 5,
        requiredRole: "quality_checker",
        checklistItems: [
          "Compare picked items to order",
          "Verify quantities",
          "Check item conditions",
          "Approve for packing",
        ],
        requiresApproval: true,
        approverRole: "supervisor",
      },
    ],
  },
]

// Get SOP by category
export function getSOPsByCategory(category: SOPCategory): SOPTemplate[] {
  return sopTemplates.filter((sop) => sop.category === category)
}

// Get SOP by ID
export function getSOPById(id: string): SOPTemplate | undefined {
  return sopTemplates.find((sop) => sop.id === id)
}

// Calculate total estimated time for a workflow
export function calculateSOPDuration(sopId: string): number {
  const sop = getSOPById(sopId)
  return sop?.estimatedTotalMinutes || 0
}
