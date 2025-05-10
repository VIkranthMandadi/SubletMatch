"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker"; // Assuming this is your component
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ListingFormProps {
  listing?: any; // Consider defining a more specific type for listing
  onSubmit: (formData: Record<string, string | number>) => Promise<void>;
  showButtons?: boolean;
  formId?: string;
}

// Default dates for the DateRangePicker if actual dates are not yet set in the state.
// You might want to make these more dynamic or sensible for your application.
const defaultPickerFromDate = new Date();
const defaultPickerToDate = new Date(new Date().setDate(new Date().getDate() + 7)); // Defaults to 7 days from today


export function ListingForm({
  listing,
  onSubmit,
  showButtons = true,
  formId,
}: ListingFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: listing?.title || "",
    description: listing?.description || "",
    price: listing?.price || 0,
    address: listing?.address || "",
    city: listing?.city || "",
    state: listing?.state || "",
    property_type: listing?.property_type || "Apartment",
    bedrooms: listing?.bedrooms || 1,
    bathrooms: listing?.bathrooms || 1,
    amenities: listing?.amenities || "",
  });

  // This state holds the *actual selected* dates, which can be undefined initially or if cleared.
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: listing?.available_from ? new Date(listing.available_from) : undefined,
    to: listing?.available_to ? new Date(listing.available_to) : undefined,
  });

  useEffect(() => {
    if (listing) {
      setFormData({
        title: listing.title || "",
        description: listing.description || "",
        price: listing.price || 0,
        address: listing.address || "",
        city: listing.city || "",
        state: listing.state || "",
        property_type: listing.property_type || "Apartment",
        bedrooms: listing.bedrooms || 1,
        bathrooms: listing.bathrooms || 1,
        amenities: listing.amenities || "",
      });
      setDateRange({
        from: listing.available_from ? new Date(listing.available_from) : undefined,
        to: listing.available_to ? new Date(listing.available_to) : undefined,
      });
    }
  }, [listing]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ["price", "bedrooms", "bathrooms"].includes(name) ? Number(value) || 0 : value,
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formData.title || !dateRange.from || !dateRange.to) {
        toast.error("Please fill in all required fields: Title and Availability Dates.");
        setIsLoading(false);
        return;
    }

    try {
      const payload = {
        ...formData,
        price: Number(formData.price) || 0,
        bedrooms: Number(formData.bedrooms) || 0,
        bathrooms: Number(formData.bathrooms) || 0,
        available_from: dateRange.from.toISOString(), // Now we know dateRange.from is a Date due to validation
        available_to: dateRange.to.toISOString(),     // Same for dateRange.to
      };
      await onSubmit(payload);
    } catch (err) {
      console.error("ListingForm: Error in onSubmit prop execution:", err);
      // The parent component (EditListingForm) should ideally handle the toast for the overall process.
      // toast.error("Failed to process listing data.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      id={formId}
      onSubmit={handleFormSubmit}
      className="max-w-4xl mx-auto space-y-10 px-4 py-8"
    >
      {/* 🏠 Basic Info */}
      <section>
        <h3 className="text-lg font-semibold mb-2">🏠 Basic Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="property_type">Property Type</Label>
            <Select value={formData.property_type} onValueChange={(val) => setFormData((p) => ({ ...p, property_type: val }))}>
              <SelectTrigger id="property_type">
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                {["Apartment", "House", "Condo", "Townhouse", "Studio", "Loft", "Duplex", "Room"].map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={5} required />
        </div>
      </section>

      {/* 📍 Location */}
      <section>
        <h3 className="text-lg font-semibold mb-2">📍 Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" value={formData.address} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" value={formData.state} onChange={handleChange} required />
          </div>
        </div>
      </section>

      {/* 📏 Details */}
      <section>
        <h3 className="text-lg font-semibold mb-2">📏 Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input id="bedrooms" name="bedrooms" type="number" min="0" value={formData.bedrooms} onChange={handleChange} required/>
          </div>
          <div>
            <Label htmlFor="bathrooms">Bathrooms</Label>
            <Input id="bathrooms" name="bathrooms" type="number" min="0" step="0.5" value={formData.bathrooms} onChange={handleChange} required/>
          </div>
          <div>
            <Label htmlFor="price">Price (per month)</Label>
            <Input id="price" name="price" type="number" min="0" value={formData.price} onChange={handleChange} required/>
          </div>
        </div>
      </section>
      

      {/* 🗓 Availability */}
      <section>
        <h3 className="text-lg font-semibold mb-2">🗓 Availability</h3>
        <DateRangePicker
          date={{
            from: dateRange.from || defaultPickerFromDate, // Pass default if actual state.from is undefined
            to: dateRange.to || defaultPickerToDate,       // Pass default if actual state.to is undefined
          }}
          onDateChange={(newDateValueFromPicker) => {
            // Update your internal state with what the picker returns.
            // This might be { from: Date, to: Date } or { from: Date, to: undefined } etc.
            setDateRange({
                from: newDateValueFromPicker?.from,
                to: newDateValueFromPicker?.to
            });
          }}
        />
        {/* This validation message checks your *actual* state, not the potentially defaulted picker display */}
        {(!dateRange.from || !dateRange.to) && (
            <p className="text-sm text-red-500 mt-1">Availability start and end dates are required.</p>
        )}
      </section>

      {/* 🧼 Amenities */}
      <section>
        <h3 className="text-lg font-semibold mb-2">🧼 Amenities</h3>
        <Textarea
          id="amenities"
          name="amenities"
          placeholder="Enter amenities separated by spaces (e.g. wifi parking pool)"
          value={formData.amenities}
          onChange={handleChange}
          rows={3}
        />
         <p className="text-xs text-muted-foreground mt-1">
            Separate each amenity with a space.
          </p>
      </section>

      {showButtons && (
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard")}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (listing ? "Save Changes" : "Create Listing")}
          </Button>
        </div>
      )}
    </form>
  );
}