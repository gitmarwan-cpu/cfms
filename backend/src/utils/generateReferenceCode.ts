/** Generate the public CFMS reference code. */
const generateReferenceCode = (): string => {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `CFMS-${year}-${randomPart}`;
};

export default generateReferenceCode;
module.exports = generateReferenceCode;
