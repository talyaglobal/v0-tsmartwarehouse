// OpenAPI 3.1 Schema Definition
// API documentation and SDK generation

export const openAPISchema = {
  openapi: "3.1.0",
  info: {
    title: "TSmart Warehouse API",
    version: "1.0.0",
    description: "Enterprise warehouse management platform API",
    contact: {
      name: "TSmart Warehouse Support",
      email: "support@tsmartwarehouse.com",
      url: "https://tsmartwarehouse.com/support",
    },
    license: {
      name: "Proprietary",
      url: "https://tsmartwarehouse.com/terms",
    },
  },
  servers: [
    {
      url: "https://api.tsmartwarehouse.com/v1",
      description: "Production",
    },
    {
      url: "https://staging-api.tsmartwarehouse.com/v1",
      description: "Staging",
    },
  ],
  tags: [
    { name: "Auth", description: "Authentication endpoints" },
    { name: "Bookings", description: "Booking management" },
    { name: "Inventory", description: "Inventory operations" },
    { name: "Invoices", description: "Invoice management" },
    { name: "Incidents", description: "Incident reporting" },
    { name: "Claims", description: "Claims processing" },
    { name: "Tasks", description: "Task management" },
    { name: "Warehouses", description: "Warehouse operations" },
    { name: "Users", description: "User management" },
  ],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "User login",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Successful login",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "401": { description: "Invalid credentials" },
          "429": { description: "Too many attempts" },
        },
      },
    },
    "/bookings": {
      get: {
        tags: ["Bookings"],
        summary: "List bookings",
        operationId: "listBookings",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/BookingStatus" } },
          { name: "customer_id", in: "query", schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": {
            description: "List of bookings",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BookingListResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Bookings"],
        summary: "Create booking",
        operationId: "createBooking",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBookingRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Booking created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Booking" },
              },
            },
          },
          "400": { description: "Invalid request" },
        },
      },
    },
    "/bookings/{id}": {
      get: {
        tags: ["Bookings"],
        summary: "Get booking details",
        operationId: "getBooking",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Booking details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Booking" },
              },
            },
          },
          "404": { description: "Booking not found" },
        },
      },
      patch: {
        tags: ["Bookings"],
        summary: "Update booking",
        operationId: "updateBooking",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateBookingRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Booking updated" },
          "404": { description: "Booking not found" },
        },
      },
    },
    "/incidents": {
      get: {
        tags: ["Incidents"],
        summary: "List incidents",
        operationId: "listIncidents",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of incidents",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/IncidentListResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Incidents"],
        summary: "Report incident",
        operationId: "createIncident",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateIncidentRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Incident reported" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          access_token: { type: "string" },
          refresh_token: { type: "string" },
          expires_in: { type: "integer" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          full_name: { type: "string" },
          role: { $ref: "#/components/schemas/UserRole" },
          is_active: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      UserRole: {
        type: "string",
        enum: ["super_admin", "admin", "worker", "customer"],
      },
      BookingStatus: {
        type: "string",
        enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
      },
      Booking: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          booking_number: { type: "string" },
          customer_id: { type: "string", format: "uuid" },
          warehouse_id: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/BookingStatus" },
          start_date: { type: "string", format: "date" },
          end_date: { type: "string", format: "date" },
          total_amount: { type: "number" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      BookingListResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/Booking" } },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      CreateBookingRequest: {
        type: "object",
        required: ["warehouse_id", "service_type", "start_date"],
        properties: {
          warehouse_id: { type: "string", format: "uuid" },
          service_type: { type: "string" },
          start_date: { type: "string", format: "date" },
          end_date: { type: "string", format: "date" },
          estimated_items: { type: "integer" },
          special_instructions: { type: "string" },
        },
      },
      UpdateBookingRequest: {
        type: "object",
        properties: {
          status: { $ref: "#/components/schemas/BookingStatus" },
          end_date: { type: "string", format: "date" },
          special_instructions: { type: "string" },
        },
      },
      Incident: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          incident_number: { type: "string" },
          type: { type: "string", enum: ["damage", "loss", "theft", "other"] },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["open", "investigating", "resolved", "closed"] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      IncidentListResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/Incident" } },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      CreateIncidentRequest: {
        type: "object",
        required: ["booking_id", "type", "severity", "title", "description"],
        properties: {
          booking_id: { type: "string", format: "uuid" },
          type: { type: "string", enum: ["damage", "loss", "theft", "other"] },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          title: { type: "string" },
          description: { type: "string" },
          affected_items: { type: "array", items: { type: "string" } },
          location: { type: "string" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          total_pages: { type: "integer" },
        },
      },
      Error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: { type: "object" },
        },
      },
    },
  },
}
