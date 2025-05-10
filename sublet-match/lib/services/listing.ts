import { authService } from "./auth";

// Define a type for the backend response when images are uploaded (matches your backend)
interface BackendUploadedImage {
  id: string;
  listing_id: string;
  created_at: string;
  image_url: string;
}

export class ListingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  }

  async getListings() {
    console.log("ListingService: getListings called");
    const response = await fetch(`${this.baseUrl}/listings`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("ListingService: getListings failed", response.status, errorText);
      throw new Error(`Failed to fetch listings: ${response.statusText} - ${errorText.substring(0,100)}`);
    }
    return response.json();
  }

  async getListing(id: string) {
    console.log(`ListingService: getListing called for ID: ${id}`);
    const response = await fetch(`${this.baseUrl}/listings/${id}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ListingService: getListing for ID ${id} failed`, response.status, errorText);
      throw new Error(`Failed to fetch listing ${id}: ${response.statusText} - ${errorText.substring(0,100)}`);
    }
    return response.json();
  }

  async getMyListings() {
    console.log("ListingService: getMyListings called");
    const token = authService.getToken();
    if (!token) {
      console.error("ListingService: getMyListings - Not authenticated");
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${this.baseUrl}/listings/my`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("ListingService: getMyListings failed", response.status, errorText);
      throw new Error(`Failed to fetch user listings: ${response.statusText} - ${errorText.substring(0,100)}`);
    }
    return response.json();
  }

  async createListing(data: any) { // data is likely a JSON object for listing details
    console.log("ListingService: createListing called with data:", data);
    const token = authService.getToken();
    if (!token) {
      console.error("ListingService: createListing - Not authenticated");
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${this.baseUrl}/listings/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Expecting JSON for listing creation
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorText = await response.text(); // Try to get text first for more details
      console.error("ListingService: createListing failed", response.status, errorText);
      try {
          const errorJson = JSON.parse(errorText); // Then try to parse as JSON
          throw new Error(errorJson.detail || `Failed to create listing: ${response.statusText}`);
      } catch (e) {
          throw new Error(`Failed to create listing: ${response.statusText} - ${errorText.substring(0,100)}`);
      }
    }
    return response.json();
  }

  // This method is for updating textual listing data.
  // It expects `data` to be FormData containing only string key-value pairs.
  async updateListing(id: string, data: FormData) {
    console.log(`ListingService: updateListing called for ID: ${id}`);
    const token = authService.getToken();
    if (!token) {
      console.error("ListingService: updateListing - Not authenticated");
      throw new Error("Not authenticated");
    }

    console.log("ListingService: updateListing - FormData to be sent:");
    for (const [key, value] of data.entries()) {
      console.log(`  ${key}: ${value}`); // Value will be string here
    }

    const response = await fetch(`${this.baseUrl}/listings/${id}`, {
      method: "PUT",
      headers: {
        // "Content-Type" header is NOT set here for FormData.
        // The browser will set it automatically with the correct boundary.
        Authorization: `Bearer ${token}`,
      },
      body: data, // `data` is already FormData
    });

    console.log("ListingService: updateListing - Response status:", response.status, "OK:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ListingService: updateListing failed", response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.detail || `Failed to update listing: ${response.statusText}`);
      } catch (e) {
        throw new Error(`Failed to update listing: ${response.statusText} - ${errorText.substring(0,100)}`);
      }
    }
    return response.json();
  }

  async deleteListing(listingId: string): Promise<{ message: string }> { // Return type based on your backend
    console.log(`ListingService: deleteListing called for ID: ${listingId}`);
    const token = authService.getToken();
    if (!token) {
      console.error("ListingService: deleteListing - Not authenticated");
      throw new Error("Not authenticated");
    }
    const response = await fetch(`${this.baseUrl}/listings/${listingId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ListingService: deleteListing failed", response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.detail || `Failed to delete listing: ${response.statusText}`);
      } catch (e) {
        throw new Error(`Failed to delete listing: ${response.statusText} - ${errorText.substring(0,100)}`);
      }
    }
    return response.json(); // Assuming backend returns { "message": "..." }
  }

  // New method for uploading listing images (bulk)
  async uploadListingImages(listingId: string, formDataWithImages: FormData): Promise<BackendUploadedImage[]> {
    console.log(`ListingService: uploadListingImages called for listing ID: ${listingId}`);
    const token = authService.getToken();
    if (!token) {
      console.error("ListingService: uploadListingImages - Not authenticated");
      throw new Error("Not authenticated for uploading images");
    }

    console.log("ListingService: uploadListingImages - FormData to be sent:");
    for (const [key, value] of formDataWithImages.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: ${value.name} (File)`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }

    const response = await fetch(`${this.baseUrl}/listings/${listingId}/images`, {
      method: "POST",
      headers: {
        // "Content-Type" is NOT set for FormData, browser handles it
        Authorization: `Bearer ${token}`,
      },
      body: formDataWithImages,
    });

    console.log("ListingService: uploadListingImages - Response status:", response.status, "OK:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ListingService: uploadListingImages failed", response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.detail || `Failed to upload images: ${response.statusText}`);
      } catch (e) {
        throw new Error(`Failed to upload images: ${response.statusText} - ${errorText.substring(0,100)}`);
      }
    }
    return response.json() as Promise<BackendUploadedImage[]>; // Cast to the expected return type
  }


  async deleteListingImage(listingId: string, imageId: string): Promise<{ message: string }> {
    console.log(`ListingService: deleteListingImage called for listing ID: ${listingId}, image ID: ${imageId}`);
    const token = authService.getToken();
    if (!token) {
      console.error("ListingService: deleteListingImage - Not authenticated");
      throw new Error("No authentication token found");
    }

    const response = await fetch(
      `${this.baseUrl}/listings/${listingId}/images/${imageId}`,
      {
        method: "DELETE",
        headers: {
          // "Content-Type": "application/json", // Not strictly needed for a DELETE with no body, but fine.
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("ListingService: deleteListingImage - Response status:", response.status, "OK:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ListingService: deleteListingImage failed", response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.detail || `Failed to delete image: ${response.statusText}`);
      } catch (e) {
        throw new Error(`Failed to delete image: ${response.statusText} - ${errorText.substring(0,100)}`);
      }
    }
    return response.json(); // Assuming backend returns { "message": "..." }
  }
}

export const listingService = new ListingService();