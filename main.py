import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SupplyWise AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class StockUpdateSchema(BaseModel):
    product_id: str
    quantity_change: float
    reason: Optional[str] = "Manual Update"

class POCreateSchema(BaseModel):
    product_id: str
    supplier_id: str
    quantity: float
    total_amount: float
    approved_by: Optional[str] = "Manager (Lim Yi-En)"

@app.get("/")
def root():
    return {"status": "online", "system": "SupplyWise AI API"}

@app.get("/inventory")
def get_inventory():
    res = supabase.table("products").select("*").execute()
    return {"data": res.data}

@app.get("/suppliers")
def get_suppliers():
    res = supabase.table("suppliers").select("*").execute()
    return {"data": res.data}

@app.get("/quotations")
def get_quotations(product_id: Optional[str] = None):
    query = supabase.table("quotations").select("*, suppliers(name, reliability_score, quality_rating), products(name, sku)")
    if product_id:
        query = query.eq("product_id", product_id)
    res = query.execute()
    return {"data": res.data}

@app.get("/purchase-orders")
def get_purchase_orders():
    res = supabase.table("purchase_orders").select("*, products(name, sku), suppliers(name)").order("created_at", desc=True).execute()
    return {"data": res.data}

@app.post("/inventory/update")
def update_inventory(payload: StockUpdateSchema):
    product = supabase.table("products").select("current_stock, name").eq("id", payload.product_id).execute()
    if not product.data:
        raise HTTPException(status_code=404, detail="Product not found")
    
    current_stock = float(product.data[0]["current_stock"])
    new_stock = current_stock + payload.quantity_change
    supabase.table("products").update({"current_stock": new_stock}).eq("id", payload.product_id).execute()

    supabase.table("activity_logs").insert({
        "action": "STOCK_UPDATE",
        "entity_type": "PRODUCT",
        "entity_id": payload.product_id,
        "details": {"previous": current_stock, "new": new_stock, "reason": payload.reason}
    }).execute()

    return {"message": "Success", "new_stock": new_stock}

@app.post("/purchase-orders")
def create_purchase_order(payload: POCreateSchema):
    po_data = {
        "product_id": payload.product_id,
        "supplier_id": payload.supplier_id,
        "quantity": payload.quantity,
        "total_amount": payload.total_amount,
        "status": "APPROVED",
        "approved_by": payload.approved_by
    }
    res = supabase.table("purchase_orders").insert(po_data).execute()
    return {"message": "PO Created", "data": res.data}

@app.get("/activity-logs")
def get_activity_logs():
    res = supabase.table("activity_logs").select("*").order("created_at", desc=True).execute()
    return {"data": res.data}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)