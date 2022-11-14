const { NotFoundError } = require("../../errors");
const ApplicationController = require("../ApplicationController");

describe("ApplicationController", () => {
  const applicationController = new ApplicationController();
  describe("#handleGetRoot", () => {
    it("should call res.status(200) and res.json with status and message", async () => {
      const mockRequest = {};
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      const result = {
        status: "OK",
        message: "BCR API is up and running!",
      };

      await applicationController.handleGetRoot(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(result);
    });
  });

  describe("#handleNotFound", () => {
    it("should call res.status(404) and res.json with error detail", async () => {
      const mockRequest = {
        method: "GET",
        url: "http://example.com",
      };
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      const err = new NotFoundError(mockRequest.method, mockRequest.url);

      const result = {
        error: {
          name: err.name,
          message: err.message,
          details: err.details,
        },
      };
      await applicationController.handleNotFound(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(result);
    });
  });

  describe("#handleError", () => {
    it("should call res.status(500) and res.json with error detail", async () => {
      const mockRequest = {};
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockErr = new Error("example error message");
      const mockNext = () => {};

      const result = {
        error: {
          name: mockErr.name,
          message: mockErr.message,
          details: mockErr.details || null,
        },
      };

      await applicationController.handleError(
        mockErr,
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(result);
    });
  });

  describe("#getOffsetFromRequest", () => {
    it("should return offset based on request (int)", () => {
      const mockRequest = {
        query: {
          page: 2,
          pageSize: 20,
        },
      };

      expect(applicationController.getOffsetFromRequest(mockRequest)).toBe(
        (mockRequest.query.page - 1) * mockRequest.query.pageSize
      );
    });
  });

  describe("#buildPaginationObject", () => {
    it("should return pagination object based on request and count", () => {
      const mockRequest = {
        query: {
          page: 2,
          pageSize: 20,
        },
      };
      const mockCount = 12;
      expect(
        applicationController.buildPaginationObject(mockRequest, mockCount)
      ).toStrictEqual({
        page: mockRequest.query.page,
        pageCount: Math.ceil(mockCount / mockRequest.query.pageSize),
        pageSize: mockRequest.query.pageSize,
        count: mockCount,
      });
    });
  });
});
