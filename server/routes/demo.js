/*
 * Tiny sample route kept with the frontend server scaffold.
 */
export const handleDemo = (req, res) => {
    const response = {
        message: "Hello from Express server",
    };
    res.status(200).json(response);
};
