describe("API /v1/user", () => {
  it('should sync db', async() => {
    const result = camelToSnakeCase({
      name: "alliano",
      fullName: "allino zyx",
      address: {
        streetName: "test",
        rt: {
          privateHome: "sample",
          collection: ["name", "email", "pass"],
          someData: {
            sampleData: "sample",
            expired: {
              expiredAt: 20,
            }
          }
        }
      }
    })

    const snacToCamel = snakeToCamelCase({
      sample_data: {
        first: "data1",
        data2: [1,2,3,4,5],
        another_data: {
          private_key: "dara private",
          public_key_key_key_key: "data public",
          data_primary: [1,2,3,4,5],
          main_data: {
            core_data: "core",
            complex_data: "complex"
          }
        }
      }
    })
    console.log(snacToCamel);
    
  });  
});


function camelToSnakeCase(obj) {
  if (typeof obj !== 'object' || obj === null) {
      return obj; // Return the value if it's not an object
  }

  if (Array.isArray(obj)) {
      return obj.map(camelToSnakeCase); // Recursively handle arrays
  }

  return Object.keys(obj).reduce((acc, key) => {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      acc[snakeKey] = camelToSnakeCase(obj[key]); // Recursively handle nested objects
      return acc;
  }, {});
}


function snakeToCamelCase(obj) {
  if (typeof obj !== 'object' || obj === null) {
      return obj; // Return the value if it's not an object
  }

  if (Array.isArray(obj)) {
      return obj.map(snakeToCamelCase); // Recursively handle arrays
  }

  return Object.keys(obj).reduce((acc, key) => {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/(_\w)/g, (matches) => matches[1].toUpperCase());
      acc[camelKey] = snakeToCamelCase(obj[key]); // Recursively handle nested objects
      return acc;
  }, {});
}

// Example usage:
// const jsonData = {
//   first_name: "John",
//   last_name: "Doe",
//   address: {
//       street_name: "Main St",
//       city_name: "Anytown"
//   },
//   hobbies: ["reading", "traveling"]
// };

// const camelCaseData = snakeToCamelCase(jsonData);
// console.log(camelCaseData);


// Example usage:
// const jsonData = {
//   firstName: "John",
//   lastName: "Doe",
//   address: {
//       streetName: "Main St",
//       cityName: "Anytown"
//   },
//   hobbies: ["reading", "traveling"]
// };

// const snakeCaseData = camelToSnakeCase(jsonData);
// console.log(snakeCaseData);