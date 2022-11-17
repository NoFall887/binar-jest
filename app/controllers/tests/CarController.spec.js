const dayjs = require("dayjs");
const { Op } = require("sequelize");
const { UserCar, Car } = require("../../models");
const CarController = require("../../controllers/CarController");

describe("CarController", () => {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockNext = jest.fn();

  const carControllerArgs = {
    carModel: Car,
    userCarModel: UserCar,
    dayjs,
  };

  // describe("#handleListCars", () => {
  //   it("should call res.status(401) and res.json with cars and metadata", async () => {
  //     const mockRequest = {
  //       query: {
  //         page: 1,
  //         pageSize: 10,
  //         size: "MEDIUM",
  //         availableAt: new Date().toString(),
  //       },
  //     };
  //     const cars = [];
  //     // generate cars data
  //     for (let i = 0; i < 10; i++) {
  //       cars.push(
  //         new Car({
  //           name: `car ${i}`,
  //           price: 100000 * i,
  //           size: mockRequest.query.size,
  //           image: `https://car${i}.id`,
  //           isCurrentlyRented: false,
  //         })
  //       );
  //     }
  //     // Build query
  //     const query = {
  //       include: {
  //         as: "userCar",
  //         model: UserCar,
  //         offset:
  //       }
  //     };

  //     const mockCarModel = {
  //       findAll: jest.fn().mockReturnThis(Promise.resolve(cars)),
  //       count: jest.fn().mockReturnThis(Promise.resolve(10)),
  //     };

  //     const carController = new CarController({
  //       ...carControllerArgs,
  //       carModel: mockCarModel,
  //     });

  //     await carController.handleListCars(mockRequest, mockResponse);

  //     expect(mockCarModel.findAll).toHaveBeenCalledWith();
  //   });
  // });
  describe("#handleRentCar", () => {});
  describe("#handleGetCar", () => {
    it("should call res.status(200) and res.json with car data", async () => {
      const mockRequest = {
        params: {
          id: 1,
        },
      };
      const car = new Car({
        name: "example car",
        price: 500000,
        size: "MEDIUM",
        image: `https://carsexampleimg.id`,
        isCurrentlyRented: false,
      });

      const mockCarModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(car)),
      };

      const carController = new CarController({
        ...carControllerArgs,
        carModel: mockCarModel,
      });
      await carController.handleGetCar(mockRequest, mockResponse);

      expect(mockCarModel.findByPk).toHaveBeenCalledWith(mockRequest.params.id);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(car);
    });
  });

  describe("#handleCreateCar", () => {
    it("should call res.status(201) and res.json with car data", async () => {
      const mockRequest = {
        body: {
          name: "Mazda",
          price: 350000,
          size: "MEDIUM",
          image: "http://binarmazdaimg.id",
        },
      };
      const createCarArgs = {
        ...mockRequest.body,
        isCurrentlyRented: false,
      };
      const car = new Car(createCarArgs);

      const mockCarModel = {
        create: jest.fn().mockReturnValue(Promise.resolve(car)),
      };
      const carController = new CarController({
        ...carControllerArgs,
        carModel: mockCarModel,
      });
      await carController.handleCreateCar(mockRequest, mockResponse);

      expect(mockCarModel.create).toHaveBeenCalledWith(createCarArgs);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(car);
    });

    it("should call res.status(422) and res.json with error message", async () => {
      const mockRequest = {};
      const carController = new CarController(carControllerArgs);
      await carController.handleCreateCar(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: expect.any(String),
          name: expect.any(String),
        },
      });
    });
  });

  describe("#handleUpdateCar", () => {
    it("should call res.status(200) and res.json with updated car data", async () => {
      const mockRequest = {
        body: {
          name: "New Mazda",
          price: 400000,
          size: "MEDIUM",
          image: "http://binarmazdaimg.id",
        },
        params: {
          id: 1,
        },
      };
      const updateCarArgs = {
        ...mockRequest.body,
        isCurrentlyRented: false,
      };

      const oldCar = {
        name: "Mazda",
        price: 350000,
        size: "MEDIUM",
        image: "http://binarmazdaimg.id",
        update: jest.fn(() => {
          this.name = mockRequest.body.name;
          this.price = mockRequest.body.price;
          this.size = mockRequest.body.size;
          this.image = mockRequest.body.image;
        }),
      };
      oldCar.update.bind(oldCar);

      const mockCarModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(oldCar)),
      };
      const carController = new CarController({
        ...carControllerArgs,
        carModel: mockCarModel,
      });
      await carController.handleUpdateCar(mockRequest, mockResponse);

      expect(mockCarModel.findByPk).toHaveBeenCalledWith(mockRequest.params.id);
      expect(oldCar.update).toHaveBeenCalledWith(updateCarArgs);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(oldCar);
    });

    it("should call res.status(422) and res.json with error message", async () => {
      const mockRequest = {};
      const carController = new CarController(carControllerArgs);
      await carController.handleUpdateCar(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: expect.any(String),
          name: expect.any(String),
        },
      });
    });
  });

  describe("#handleDeleteCar", () => {
    it("should cal res.status(204) and end", async () => {
      const car = new Car({
        name: "New Mazda",
        price: 400000,
        size: "MEDIUM",
        image: "http://binarmazdaimg.id",
      });
      const mockRequest = {
        params: {
          id: 1,
        },
      };
      const mockCarModel = {
        destroy: jest.fn().mockReturnValue(Promise.resolve(1)),
      };
      const carController = new CarController({
        ...carControllerArgs,
        carModel: mockCarModel,
      });
      const deleteMockResponse = {
        ...mockResponse,
        end: jest.fn().mockReturnThis(),
      };
      await carController.handleDeleteCar(mockRequest, deleteMockResponse);

      expect(deleteMockResponse.status).toHaveBeenCalledWith(204);
      expect(deleteMockResponse.end).toHaveBeenCalled();
    });
  });
});
