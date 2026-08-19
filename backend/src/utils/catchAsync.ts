type AsyncHandler = (req: any, res: any, next: (error?: unknown) => void) => unknown;

const catchAsync = (fn: AsyncHandler) => (req: any, res: any, next: (error?: unknown) => void): void => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
module.exports = catchAsync;
