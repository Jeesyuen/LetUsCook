import os
import sys
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# Comma-separated list of frontend origins allowed to call the API
FRONTEND_ORIGINS = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

# Graceful environment variable check
if not SUPABASE_URL or not SUPABASE_KEY:
    print("\n[ERROR] Missing environment variables!")
    print("Please set SUPABASE_URL and SUPABASE_KEY in your .env file.")
    print("Refer to .env.example for guidance.\n")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="SupplyWise AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Input Models ---

class StockUpdate(BaseModel):
    product_id: str
    quantity_change: int

class POCreate(BaseModel):
    supplier_id: str
    product_id: str
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    unit_price: float = Field(..., gt=0, description="Unit price must be greater than 0")
    created_by: Optional[str] = "Staff"

class POApprove(BaseModel):
    approver_name: str = Field(default="Manager", min_length=1)

# --- Routes ---

@app.get("/")
def root():
    return {"status": "online", "message": "SupplyWise AI API running successfully"}

@app.get("/inventory")
def get_inventory():
    return supabase.table("products").select("*").execute().data

@app.get("/suppliers")
def get_suppliers():
    return supabase.table("suppliers").select("*").execute().data

@app.get("/quotations")
def get_quotations():
    return supabase.table("quotations").select("*").execute().data

@app.get("/purchase-orders")
def get_purchase_orders():
    return supabase.table("purchase_orders").select("*").execute().data

@app.get("/activity-logs")
def get_activity_logs():
    return supabase.table("activity_logs").select("*").execute().data

@app.post("/purchase-orders", status_code=status.HTTP_201_CREATED)
def create_purchase_order(po: POCreate):
    # Verify product
    prod = supabase.table("products").select("id").eq("id", po.product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail=f"Product with ID '{po.product_id}' not found")

    # Verify supplier
    sup = supabase.table("suppliers").select("id").eq("id", po.supplier_id).execute()
    if not sup.data:
        raise HTTPException(status_code=404, detail=f"Supplier with ID '{po.supplier_id}' not found")

    # Calculate total server-side
    total_amount = round(po.quantity * po.unit_price, 2)

    res = supabase.table("purchase_orders").insert({
        "supplier_id": po.supplier_id,
        "product_id": po.product_id,
        "quantity": po.quantity,
        "unit_price": po.unit_price,
        "total_amount": total_amount,
        "status": "Draft",  # Matches frontend default status
        "created_by": po.created_by,
        "approved_by": None
    }).execute()

    supabase.table("activity_logs").insert({
        "action": "CREATE_PO",
        "details": f"Created PO for product {po.product_id} with status 'Draft'"
    }).execute()

    return res.data

@app.post("/purchase-orders/{po_id}/approve")
def approve_purchase_order(po_id: str, body: POApprove):
    po = supabase.table("purchase_orders").select("*").eq("id", po_id).execute()
    if not po.data:
        raise HTTPException(status_code=404, detail=f"Purchase order '{po_id}' not found")

    res = supabase.table("purchase_orders").update({
        "status": "Approved",
        "approved_by": body.approver_name
    }).eq("id", po_id).execute()

    supabase.table("activity_logs").insert({
        "action": "APPROVE_PO",
        "details": f"PO {po_id} approved by {body.approver_name}"
    }).execute()

    return res.data

@app.post("/inventory/update")
def update_stock(data: StockUpdate):
    prod = supabase.table("products").select("*").eq("id", data.product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail=f"Product '{data.product_id}' not found")

    current_stock = prod.data[0]["stock_quantity"]
    new_stock = current_stock + data.quantity_change

    if new_stock < 0:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. Current: {current_stock}, requested reduction: {abs(data.quantity_change)}")

    res = supabase.table("products").update({"stock_quantity": new_stock}).eq("id", data.product_id).execute()

    supabase.table("activity_logs").insert({
        "action": "UPDATE_STOCK",
        "details": f"Stock for product {data.product_id} updated from {current_stock} to {new_stock}"
    }).execute()

    return res.data
