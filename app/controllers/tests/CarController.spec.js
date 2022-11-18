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

  describe("#handleListCars", () => {
    // [page, pageSize, size, availableAt]
    const queryList = [
      new Array(4).fill(undefined),
      [2, ...new Array(3).fill(undefined)],
      [2, 25, ...new Array(2).fill(undefined)],
      [2, 25, "MEDIUM", undefined],
      [2, 25, "MEDIUM", new Date().toString()],
    ];
    const cars = [];
    // generate cars data
    for (let i = 0; i < 1; i++) {
      cars.push(
        new Car({
          name: `car ${i}`,
          price: 100000 * i,
          size: "MEDIUM",
          image: `https://car${i}.id`,
          isCurrentlyRented: false,
        })
      );
    }
    test.each(queryList)(
      "should call res.status(200) and res.json with cars and metadata",
      async (page, pageSize, size, availableAt) => {
        const mockRequest = {
          query: {
            page,
            pageSize,
            size,
            availableAt,
          },
        };

        // Build query
        const query = {
          limit: mockRequest.query.pageSize || 10,
          where: {},
          include: {
            model: UserCar,
            as: "userCar",
            required: false,
          },
          offset:
            ((mockRequest.query.page || 1) - 1) *
            (mockRequest.query.pageSize || 10),
        };
        if (size) query.where.size = size;
        if (availableAt) {
          query.include.where = {
            rentEndedAt: {
              [Op.gte]: availableAt,
            },
          };
        }

        const mockCarModel = {
          findAll: jest.fn().mockReturnValue(Promise.resolve(cars)),
          count: jest.fn().mockReturnValue(Promise.resolve(cars.length)),
        };

        const pagination = {
          page: mockRequest.query.page || 1,
          pageCount: Math.ceil(cars.length / (pageSize || 10)),
          pageSize: mockRequest.query.pageSize || 10,
          count: cars.length,
        };

        const carController = new CarController({
          ...carControllerArgs,
          carModel: mockCarModel,
        });

        await carController.handleListCars(mockRequest, mockResponse);

        expect(mockCarModel.findAll).toHaveBeenCalledWith(query);
        expect(mockCarModel.count).toHaveBeenCalledWith({
          where: query.where,
          include: query.include,
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          cars,
          meta: {
            pagination,
          },
        });
      }
    );
  });

  describe("#handleRentCar", () => {
    function generateActiveRentQuery(car, rentStartedAt, rentEndedAt) {
      return {
        where: {
          carId: car.id,
          rentStartedAt: {
            [Op.gte]: rentStartedAt,
          },
          rentEndedAt: {
            [Op.lte]: rentEndedAt,
          },
        },
      };
    }

    const car = new Car({
      id: 1,
      name: "example car",
      price: 500000,
      size: "MEDIUM",
      image: `https://carsexampleimg.id`,
      isCurrentlyRented: false,
    });
    const mockCarModel = {
      findByPk: jest.fn().mockReturnValue(Promise.resolve(car)),
    };
    test.each([dayjs(new Date()).add(3, "day").toString(), null])(
      "should call res.status(200) and res.json with userCar data",
      async (rentEnd) => {
        const mockRequest = {
          body: {
            rentStartedAt: new Date().toString(),
            rentEndedAt: rentEnd,
          },
          user: {
            id: 1,
          },
          params: {
            id: 1,
          },
        };

        if (!rentEnd)
          mockRequest.body.rentEndedAt = dayjs(rentEnd).add(1, "day");

        const userCarArgs = {
          userId: mockRequest.user.id,
          carId: mockRequest.params.id,
          rentStartedAt: mockRequest.body.rentStartedAt,
          rentEndedAt: mockRequest.body.rentEndedAt,
        };
        const userCar = new UserCar(userCarArgs);

        const mockUserCar = {
          findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
          create: jest.fn().mockReturnValue(Promise.resolve(userCar)),
        };

        const carController = new CarController({
          ...carControllerArgs,
          carModel: mockCarModel,
          userCarModel: mockUserCar,
        });

        await carController.handleRentCar(mockRequest, mockResponse, mockNext);

        expect(mockCarModel.findByPk).toHaveBeenCalledWith(
          mockRequest.params.id
        );
        expect(mockUserCar.findOne).toHaveBeenCalledWith(
          generateActiveRentQuery(
            car,
            mockRequest.body.rentStartedAt,
            mockRequest.body.rentEndedAt
          )
        );
        expect(mockUserCar.create).toHaveBeenCalledWith(userCarArgs);
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith(userCar);
      }
    );

    it("should call res.status(422) and res.json with car already rented error", async () => {
      const activeRentDate = {
        rentStartedAt: new Date().toString(),
        rentEndedAt: dayjs(new Date()).add(2, "day").toString(),
      };
      const mockRequest = {
        body: activeRentDate,
        user: {
          id: 1,
        },
        params: {
          id: 1,
        },
      };

      const userCarArgs = {
        userId: mockRequest.user.id,
        carId: mockRequest.params.id,
        rentStartedAt: mockRequest.body.rentStartedAt,
        rentEndedAt: mockRequest.body.rentEndedAt,
      };
      const userCar = new UserCar(userCarArgs);

      const mockUserCar = {
        findOne: jest.fn().mockReturnValue(Promise.resolve(userCar)),
      };

      const carController = new CarController({
        ...carControllerArgs,
        carModel: mockCarModel,
        userCarModel: mockUserCar,
      });

      await carController.handleRentCar(mockRequest, mockResponse, mockNext);

      expect(mockCarModel.findByPk).toHaveBeenCalledWith(mockRequest.params.id);
      expect(mockUserCar.findOne).toHaveBeenCalledWith(
        generateActiveRentQuery(
          car,
          mockRequest.body.rentStartedAt,
          mockRequest.body.rentEndedAt
        )
      );
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        new Error(`${car.name} is already rented!!`)
      );
    });

    it("should cal next(error)", async () => {
      const mockRequest = {};

      const carController = new CarController({
        ...carControllerArgs,
      });
      await carController.handleRentCar(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

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
