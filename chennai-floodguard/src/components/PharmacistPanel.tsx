import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Plus, Minus, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PharmacistPanelProps {
  userId?: string;
}

const PharmacistPanel = ({ userId }: PharmacistPanelProps) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    fetchInventory();

    // Realtime updates
    const channel = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        () => {
          fetchInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*, camp:camps(name, address)")
        .order("item_name");

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  const updateInventory = async (itemId: string, change: number) => {
    setLoading(true);
    try {
      const item = inventory.find((i) => i.id === itemId);
      if (!item) return;

      const newQuantity = Math.max(0, item.quantity + change);

      const { error } = await supabase
        .from("inventory")
        .update({
          quantity: newQuantity,
          updated_by: userId,
          last_updated: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;

      toast.success(
        `${item.item_name} ${change > 0 ? "added" : "removed"} successfully`
      );
      fetchInventory();
    } catch (error: any) {
      toast.error("Failed to update inventory");
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (quantity: number, minThreshold: number): { label: string; variant: "default" | "destructive" | "success" | "warning" } => {
    if (quantity === 0) return { label: "Out of Stock", variant: "destructive" };
    if (quantity < minThreshold) return { label: "Low Stock", variant: "warning" };
    return { label: "In Stock", variant: "success" };
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <Package className="h-6 w-6 text-primary" />
          Inventory Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Track and manage relief camp supplies
        </p>
      </div>

      <div className="space-y-3 flex-1 overflow-auto">
        {inventory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Inventory Items</p>
              <p className="text-sm text-muted-foreground">
                Inventory items will appear here
              </p>
            </div>
          </div>
        ) : (
          inventory.map((item) => {
            const status = getStockStatus(item.quantity, item.min_threshold);
            return (
              <div
                key={item.id}
                className="p-4 bg-card border border-border rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{item.item_name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.camp?.name}
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{item.quantity}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateInventory(item.id, -10)}
                      disabled={loading || item.quantity === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateInventory(item.id, 10)}
                      disabled={loading}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {item.quantity < item.min_threshold && (
                  <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-warning-foreground">
                      Below minimum threshold ({item.min_threshold} {item.unit})
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PharmacistPanel;
