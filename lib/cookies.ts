/**
 * Grabs the cookie with name from the request headers
 */
export const getCookie = (request: Request, name: string) => {
 let result: string | undefined;
 const cookieString = request.headers.get("Cookie");
 if (cookieString) {
   const cookies = cookieString.split(";");
   cookies.forEach((cookie) => {
     const cookieName = cookie.split("=")[0].trim();
     if (cookieName === name) {
       const cookieVal = cookie.replace(`${name}=`, "").trim();
       result = cookieVal;
     }
   });
 }
 return result;
};