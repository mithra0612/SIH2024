// app/api/post-office-suggestions/route.js
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { createConnection } from "mysql2/promise";

if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
});

const POST_OFFICE_SCHEMES = [
  {
    name: "Post Office Savings Account",
    eligibility: { 
      minAge: 0, 
      maxAge: 100, 
      types: ["general", "youth", "senior"]
    },
    description: "Basic savings account suitable for all age groups"
  },
  {
    name: "Recurring Deposit Scheme (RD)",
    eligibility: { 
      minAge: 18, 
      maxAge: 55, 
      types: ["working", "salaried"]
    },
    description: "Regular monthly deposit scheme for disciplined savings"
  },
  {
    name: "Public Provident Fund (PPF)",
    eligibility: { 
      minAge: 18, 
      maxAge: 60, 
      types: ["salaried", "self-employed", "general"]
    },
    description: "Long-term tax-saving investment with attractive returns"
  },
  {
    name: "Senior Citizen Savings Scheme (SCSS)",
    eligibility: { 
      minAge: 60, 
      maxAge: 100, 
      types: ["retired", "senior"]
    },
    description: "Special savings scheme for retired individuals with higher interest rates"
  },
  {
    name: "Sukanya Samriddhi Yojana (SSA)",
    eligibility: { 
      minAge: 0, 
      maxAge: 10, 
      types: ["girl_child"]
    },
    description: "Savings scheme specifically for the girl child's future education and marriage"
  },
  {
    name: "Atal Pension Yojana (APY)",
    eligibility: { 
      minAge: 18, 
      maxAge: 40, 
      types: ["working", "unorganized_sector"]
    },
    description: "Pension scheme targeting workers in the unorganized sector"
  },
  {
    name: "Mahila Samman Savings Certificate",
    eligibility: { 
      minAge: 18, 
      maxAge: 55, 
      types: ["women"]
    },
    description: "Special savings certificate designed for women"
  },
  {
    name: "Time Deposit (TD)",
    eligibility: { 
      minAge: 18, 
      maxAge: 80, 
      types: ["general", "investor"]
    },
    description: "Fixed deposit with flexible tenure options"
  },
  {
    name: "National Savings Certificate (NSC)",
    eligibility: { 
      minAge: 18, 
      maxAge: 60, 
      types: ["investor", "tax_saver"]
    },
    description: "Tax-saving investment instrument with government backing"
  }
];

const getConnection = async () => {
  return await createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT, 
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DATABASE,
    password: process.env.MYSQL_PASSWORD,
    ssl: {
      rejectUnauthorized: false,
    },
  });
};

const extractJson = (responseText) => {
  try {
    try {
      return JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const cleanJson = jsonMatch[1].trim();
        return JSON.parse(cleanJson);
      }
      
      const possibleJson = responseText.match(/\{[\s\S]*\}/);
      if (possibleJson) {
        return JSON.parse(possibleJson[0]);
      }
    }
    throw new Error("No valid JSON found in the response");
  } catch (error) {
    console.error("JSON parsing error:", error);
    return { 
      query: null, 
      message: "Failed to parse SQL query",
      error: error.message,
      rawResponse: responseText 
    };
  }
};

const generateSQLQuery = async (prompt) => {
  const system_prompt = {
    database_structure: {
      tamilnadustatistics: {
        description: "Comprehensive demographic statistics for Tamil Nadu",
        key_columns: [
          "name", "district", 
          "totP", "totM", "totF", "noHh","p06","m06",
          "f06","pLit","mLit","fLit","pIll","mIll","fIll",
          "totWorkP","totWorkM","totWorkF","mainworkP",
          "mainworkM","mainworkF","mainClP","mainClM",
          "margAlP", "margAlM", "margAlF",
          "margHhP", "margHhM", "margHhF",
          "margOtP", "margOtM", "margOtF",
          "margwork36P", "margwork36M", "margwork36F",
          "margCl36P", "margCl36M", "margCl36F",
          "margAl36P", "margAl36M", "margAl36F",
          "margHh36P", "margHh36M", "margHh36F",
          "margOt36P", "margOt36M", "margOt36F",
          "margwork03P", "margwork03M", "margwork03F",
          "margCl03P", "margCl03M", "margCl03F",
          "margAl03P", "margAl03M", "margAl03F",
          "margHh03P", "margHh03M", "margHh03F",
          "margOt03P", "margOt03M", "margOt03F",
          "nonWorkP", "nonWorkM", "nonWorkF",
          "population2540", "population4060", "population60Plus"
        ]
      }
    },
    persona: "You are an SQL query generator for Tamil Nadu demographic data analysis.",
    objective: "Generate precise SQL queries to extract demographic insights based on user requirements.",
    instructions: [
      "Return only valid JSON with message and query fields",
      "Analyze the user's request to understand specific demographic information needs",
      "Use appropriate WHERE, GROUP BY, and aggregation functions",
      "Provide meaningful insights through SQL queries"
    ],
    response_format: {
      message: "Brief explanation of the query",
      query: "The SQL query"
    }
  };

  try {
    const response = await generateText({
      model: google("gemini-1.5-flash-latest"),
      prompt: `Given the following request: "${prompt}", generate an SQL query to extract demographic statistics. Return your response as a JSON object with 'message' and 'query' fields. ${JSON.stringify(system_prompt)}`,
      maxSteps: 5,
    });

    const result = extractJson(response.text);
    
    if (!result.query) {
      throw new Error(`Invalid query generated: ${JSON.stringify(result)}`);
    }
    
    return result;
  } catch (error) {
    console.error("Error generating SQL query:", error);
    throw new Error(`Failed to generate SQL query: ${error.message}`);
  }
};

const generateResultInterpretation = async (prompt, statistics) => {
  try {
    const response = await generateText({
      model: google("gemini-1.5-flash-latest"),
      prompt: `Provide a detailed, insightful interpretation of the demographic statistics for the query: "${prompt}". 
      Statistics data: ${JSON.stringify(statistics)}
      
      Guidelines:
      - Provide a comprehensive analysis
      - Highlight key demographic insights
      - Use clear, concise language
      - Focus on meaningful interpretations of the data`,
      maxSteps: 5,
    });

    return response.text;
  } catch (error) {
    console.error("Error generating result interpretation:", error);
    return "Unable to generate detailed interpretation of the statistics.";
  }
};

const normalizeStatisticsData = (data) => {
  return data.map(item => ({
    ...item,
    totP: Number(item.totP) || 0,
    totM: Number(item.totM) || 0,
    totF: Number(item.totF) || 0,
    population717: Number(item.population717) || 0,
    population1824: Number(item.population1824) || 0,
    population2540: Number(item.population2540) || 0,
    population4060: Number(item.population4060) || 0,
    population60Plus: Number(item.population60Plus) || 0,
    district: item.district || 'Not specified',
    sub_district: item.sub_district || 'Not specified',
    level: item.level || 'Unknown'
  }));
};

const suggestPostOfficeSchemes = (statistics) => {
  const suggestedSchemes = [];

  statistics.forEach(stat => {
    const population2540 = stat.population2540 || 0;
    const population4060 = stat.population4060 || 0;
    const population60Plus = stat.population60Plus || 0;
    const population1824 = stat.population1824 || 0;
    const population717 = stat.population717 || 0;
    const totF = stat.totF || 0;

    const analyzeSchemes = (scheme) => {
      let matches = false;
      let matchReason = "";

      switch(scheme.name) {
        case "Post Office Savings Account":
          matches = true;
          matchReason = "Suitable for all age groups and demographics";
          break;
        
        case "Recurring Deposit Scheme (RD)":
          if (population2540 > 0 && population1824 > 0) {
            matches = true;
            matchReason = "Ideal for young working professionals with steady income";
          }
          break;
        
        case "Public Provident Fund (PPF)":
          if (population2540 > 0 && population4060 > 0) {
            matches = true;
            matchReason = "Excellent tax-saving option for mid-career professionals";
          }
          break;
        
        case "Senior Citizen Savings Scheme (SCSS)":
          if (population60Plus > 0) {
            matches = true;
            matchReason = "Tailored specifically for retired individuals seeking secure returns";
          }
          break;
        
        case "Sukanya Samriddhi Yojana (SSA)":
          if (population717 > 0) {
            matches = true;
            matchReason = "Perfect for families with girl children's future planning";
          }
          break;
        
        case "Atal Pension Yojana (APY)":
          if (population2540 > 0 && population1824 > 0) {
            matches = true;
            matchReason = "Designed for young workers in unorganized sectors seeking pension security";
          }
          break;
        
        case "Mahila Samman Savings Certificate":
          if (totF > 0) {
            matches = true;
            matchReason = "Special savings option exclusively for women";
          }
          break;
        
        case "Time Deposit (TD)":
          if (population2540 > 0 && population4060 > 0) {
            matches = true;
            matchReason = "Flexible investment option for professionals looking to park funds";
          }
          break;
        
        case "National Savings Certificate (NSC)":
          if (population2540 > 0 && population4060 > 0) {
            matches = true;
            matchReason = "Tax-saving investment with government security";
          }
          break;
      }

      return matches ? { 
        scheme: scheme.name, 
        description: scheme.description,
        matchReason: matchReason 
      } : null;
    };

    const schemeMatches = POST_OFFICE_SCHEMES
      .map(analyzeSchemes)
      .filter(match => match !== null);

    suggestedSchemes.push(...schemeMatches);
  });

  // Remove duplicates while preserving match reasons
  const uniqueSchemes = Array.from(
    new Map(suggestedSchemes.map(s => [s.scheme, s])).values()
  );

  return uniqueSchemes;
};

const access_db = async (message) => {
  try {
    const queryResult = await generateSQLQuery(message);
    if (!queryResult.query) {
      throw new Error("Failed to generate SQL query");
    }
    
    const connection = await getConnection();
    const [rows] = await connection.execute(queryResult.query);
    await connection.end();
    
    if (!Array.isArray(rows)) {
      throw new Error("Invalid database response format");
    }
    
    const normalizedData = normalizeStatisticsData(rows);
    const interpretation = await generateResultInterpretation(message, normalizedData);
    const suggestedSchemes = suggestPostOfficeSchemes(normalizedData);
    
    return { 
      success: true, 
      statistics: normalizedData,
      query: queryResult.query,
      queryMessage: queryResult.message,
      interpretation: interpretation,
      suggestedSchemes: suggestedSchemes
    };
  } catch (error) {
    console.error("Error in accessing Database:", error);
    return { success: false, error: error.message };
  }
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages } = body;
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const dbResult = await access_db(messages[messages.length - 1].content);
    
    if (!dbResult.success) {
      return new Response(JSON.stringify({ error: dbResult.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(dbResult), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error in POST request:", error);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}