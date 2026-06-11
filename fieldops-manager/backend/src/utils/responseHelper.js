const success = (res, data = {}, message = "Success", statusCode = 200, pagination = null) => {
  const response = { success: true, data, message };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

const created = (res, data = {}, message = "Created successfully") =>
  success(res, data, message, 201);

const error = (res, message = "An error occurred", statusCode = 500, errDetail = null) => {
  const response = { success: false, message };
  if (errDetail && process.env.NODE_ENV !== "production") response.error = errDetail;
  return res.status(statusCode).json(response);
};

const paginate = (total, page, limit) => ({
  total,
  page: parseInt(page, 10),
  limit: parseInt(limit, 10),
  totalPages: Math.ceil(total / limit),
});

module.exports = { success, created, error, paginate };
