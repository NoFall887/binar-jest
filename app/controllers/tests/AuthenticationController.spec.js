const AuthenticationController = require("../AuthenticationController");
const { JWT_SIGNATURE_KEY } = require("../../../config/application");
const jwt = require("jsonwebtoken");
const { User, Role } = require("../../models");
const bcrypt = require("bcryptjs");

describe("AuthenticationController", () => {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockNext = jest.fn();

  function encryptPassword(password) {
    return bcrypt.hashSync(password, 10);
  }

  function createToken(user, role) {
    let accessToken = jwt
      .sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: {
            id: role.id,
            name: role.name,
          },
        },
        JWT_SIGNATURE_KEY
      )
      .split(".");
    accessToken = `${accessToken[0]}.${accessToken[1]}`;
    return accessToken;
  }

  const authenticationControllerArgs = {
    // override userModel or roleModel on object instantiation when neccessary
    userModel: User,
    roleModel: Role,
    bcrypt,
    jwt,
  };

  describe("#authorize", () => {
    const authenticationController = new AuthenticationController(
      authenticationControllerArgs
    );

    function createRequest(tokenPayload) {
      return {
        headers: {
          authorization: "Bearer " + jwt.sign(tokenPayload, JWT_SIGNATURE_KEY),
        },
      };
    }
    const role = "ADMIN";
    const user = {
      id: 1,
      name: "john",
      email: "john@doe",
      image: "john doe image",
      role: {
        id: 1,
        name: role,
      },
    };
    it("should set user object in request object and call next", async () => {
      const mockRequest = createRequest(user);

      await authenticationController.authorize(role)(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockRequest).toHaveProperty("user", {
        ...user,
        iat: expect.any(Number),
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("should call res.status(401) and res.json with error detail", async () => {
      const expectedRole = "CUSTOMER";

      const mockRequest = createRequest(user);
      const result = {
        error: {
          name: "Error",
          message: "Access forbidden!",
          details: {
            role: role,
            reason: `${role} is not allowed to perform this operation.`,
          },
        },
      };
      await authenticationController.authorize(expectedRole)(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(result);
    });
  });

  describe("#handleLogin", () => {
    const availableEmail = "john@doe";
    const passString = "john doe password";
    const role = new Role({ name: "ADMIN" });
    const user = new User({
      name: "john doe",
      email: availableEmail,
      image: "john doe image",
      encryptedPassword: encryptPassword(passString),
      roleId: 1,
    });
    user.Role = role;

    it("should call res.status(201) and res.json with access token", async () => {
      let accessToken = createToken(user, role);

      const mockRequest = {
        body: {
          email: availableEmail,
          password: passString,
        },
      };

      const mockUserModel = {
        findOne: jest.fn().mockReturnValue(Promise.resolve(user)),
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
      });

      await authenticationController.handleLogin(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email: mockRequest.body.email },
        include: [{ model: Role, attributes: ["id", "name"] }],
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.stringMatching(
            new RegExp(`${accessToken}\\.[a-zA-Z0-9-_]+$`)
          ),
        })
      );
    });

    it("should call res.status(401) and res.json with wrong password error", async () => {
      const mockRequest = {
        body: {
          email: availableEmail,
          password: "a wrong password",
        },
      };
      const mockUserModel = {
        findOne: jest.fn().mockReturnValue(Promise.resolve(user)),
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
      });

      await authenticationController.handleLogin(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email: mockRequest.body.email },
        include: [{ model: Role, attributes: ["id", "name"] }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        new Error("Password is not correct!")
      );
    });

    it("should call res.status(404) and res.json with not registered error", async () => {
      const mockRequest = {
        body: {
          email: "wrong@email",
          password: passString,
        },
      };
      const mockUserModel = {
        findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
      });
      await authenticationController.handleLogin(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email: mockRequest.body.email },
        include: [{ model: Role, attributes: ["id", "name"] }],
      });
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        new Error(`${mockRequest.body.email} is not registered!`)
      );
    });

    it("should call next(err)", async () => {
      const mockRequest = {
        body: {
          email: null,
        },
      };
      const authenticationController = new AuthenticationController(
        authenticationControllerArgs
      );
      await authenticationController.handleLogin(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("#handleRegister", () => {
    const availableUser = new User({
      name: "john doe",
      email: "john@doe",
      image: "john doe image",
      encryptedPassword: encryptPassword("john doe password"),
      roleId: 1,
    });

    const role = new Role({ name: "CUSTOMER" });

    const mockRoleModel = {
      findOne: jest.fn().mockReturnValue(Promise.resolve(role)),
    };

    it("should call res.status(201) and res.json with access token", async () => {
      const mockRequest = {
        body: {
          name: "fulan",
          email: "fulan@gmail",
          password: "fulan password",
        },
      };
      const userScheme = {
        name: mockRequest.body.name,
        email: mockRequest.body.email,
        roleId: role.id,
        encryptedPassword: encryptPassword(mockRequest.body.password),
      };

      const user = new User(userScheme);

      const mockUserModel = {
        findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
        create: jest.fn().mockReturnValue(Promise.resolve(user)),
      };

      const accessToken = createToken(user, role);

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        roleModel: mockRoleModel,
        userModel: mockUserModel,
      });

      await authenticationController.handleRegister(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email: user.email },
      });

      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...userScheme,
          encryptedPassword: expect.not.stringMatching(
            mockRequest.body.password
          ),
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.stringMatching(
            new RegExp(`${accessToken}\\.[a-zA-Z0-9-_]+$`)
          ),
        })
      );
    });

    it("should call res.status(201) and res.json with error email already taken", async () => {
      const mockRequest = {
        body: {
          name: "fulan",
          email: availableUser.email,
          password: "fulan password",
        },
      };

      const mockUserModel = {
        findOne: jest.fn().mockReturnValue(Promise.resolve(availableUser)),
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
      });

      await authenticationController.handleRegister(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        new Error(`${mockRequest.body.email} is already registered!`)
      );
    });

    it("should call next(err)", async () => {
      const mockRequest = {};
      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
      });

      await authenticationController.handleRegister(
        mockRequest,
        mockResponse,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("#handleGetUser", () => {
    const roleName = "ADMIN";
    const mockRequest = {
      user: {
        id: 1,
        name: "john",
        email: "john@doe",
        image: "john doe image",
        role: {
          id: 1,
          name: roleName,
        },
      },
    };
    const user = new User({
      name: mockRequest.user.name,
      email: mockRequest.user.email,
      image: mockRequest.user.image,
      encryptedPassword: encryptPassword("john doe password"),
      roleId: mockRequest.user.role.id,
    });

    it("should call res.status(200) and res.json with user data", async () => {
      const mockUserModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(user)),
      };

      const role = new Role({ name: roleName });
      const mockRoleModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(role)),
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
        roleModel: mockRoleModel,
      });

      await authenticationController.handleGetUser(mockRequest, mockResponse);

      expect(mockUserModel.findByPk).toHaveBeenCalledWith(mockRequest.user.id);
      expect(mockRoleModel.findByPk).toHaveBeenCalledWith(
        mockRequest.user.role.id
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(user);
    });

    it("should call res.status(404) and res.json with record(user) not found error", async () => {
      const mockUserModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(null)),
        name: User.name,
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
      });
      await authenticationController.handleGetUser(mockRequest, mockResponse);

      expect(mockUserModel.findByPk).toHaveBeenCalledWith(mockRequest.user.id);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        new Error(`${User.name} not found!`)
      );
    });

    it("should call res.status(404) and res.json with record(role) not found error", async () => {
      const mockUserModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(user)),
      };
      const mockRoleModel = {
        findByPk: jest.fn().mockReturnValue(Promise.resolve(null)),
        name: Role.name,
      };

      const authenticationController = new AuthenticationController({
        ...authenticationControllerArgs,
        userModel: mockUserModel,
        roleModel: mockRoleModel,
      });
      await authenticationController.handleGetUser(mockRequest, mockResponse);

      expect(mockUserModel.findByPk).toHaveBeenCalledWith(mockRequest.user.id);
      expect(mockRoleModel.findByPk).toHaveBeenCalledWith(
        mockRequest.user.role.id
      );
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        new Error(`${Role.name} not found!`)
      );
    });
  });
});
