const { error } = require("../utils/responseHelper");

const validate = (schema, property = "body") => (req, res, next) => {
  const { error: validationError } = schema.validate(req[property], { abortEarly: false, allowUnknown: false });
  if (validationError) {
    const details = validationError.details.map((d) => d.message).join("; ");
    return error(res, details, 400);
  }
  next();
};

module.exports = validate;
