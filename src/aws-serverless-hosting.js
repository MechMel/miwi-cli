const fs = require("fs");
const path = require("path");
const runCmd = require("./utils/run-cmd");
const { rmdirContents } = require("./utils/utils");
const yaml = require("js-yaml");

const hostingDetailsFileName = `aws-hosting-details.json`;
const CLOUD_BUILD_DIR = `./.miwi/cloud-build`;

module.exports = {
  getAwsHostingDetails: (cloudDir) => `${cloudDir}/${hostingDetailsFileName}`,
  CLOUD_BUILD_DIR: CLOUD_BUILD_DIR,
  createInitialProject: async (outDir) => {
    // Build the default cloud project
    if (fs.existsSync(outDir)) {
      rmdirContents(outDir);
      fs.rmdirSync(outDir);
    }
    const getBaseNameFromCloudDir = (absoluteOutDir, relativeDir) => {
      if (path.dirname(relativeDir) != `.`) {
        return getBaseNameFromCloudDir(
          path.join(absoluteOutDir, `../`),
          path.join(relativeDir, `../`),
        );
      } else {
        return path.basename(path.join(absoluteOutDir, `../`));
      }
    };
    const projectBaseName = getBaseNameFromCloudDir(
      path.resolve(outDir),
      CLOUD_BUILD_DIR,
    );
    await runCmd({
      command: `serverless create --template "aws-nodejs" --path "${outDir}" --name "${projectBaseName}"`,
      path: `./`,
    });
    const serverlessConfigPath = `${outDir}/serverless.yml`;
    console.log(`Creating the Serverless project...`);
    let serverlessConfig = yaml.load(
      fs.readFileSync(serverlessConfigPath, { encoding: "utf-8" }),
    );
    serverlessConfig.provider.profile = `tke-rel`;
    serverlessConfig.provider.region = "us-east-1";
    serverlessConfig.provider.stage = "rel";
    serverlessConfig.provider.timeout = 30;
    serverlessConfig.provider.memorySize = 128;
    // Remove the default functions
    delete serverlessConfig.functions;
    fs.unlinkSync(`${outDir}/handler.js`);
    // Add Resources
    if (serverlessConfig.resources === undefined) {
      serverlessConfig.resources = { Resources: {} };
    }
    for (resourceLogicalName in awsHostingResources) {
      serverlessConfig.resources.Resources[resourceLogicalName] =
        awsHostingResources[resourceLogicalName];
    }
    serverlessConfig.plugins = ["serverless-stack-output"];
    serverlessConfig.custom = {
      output: {
        file: hostingDetailsFileName,
      },
    };
    serverlessConfig.resources.Outputs = {
      cloudFrontDistributionID: {
        Value: {
          Ref: "WebsiteCloudFrontDistribution",
        },
      },
      hostingBucketID: {
        Value: {
          Ref: "WebsiteHostingBucket",
        },
      },
      pwaURL: {
        Value: {
          "Fn::GetAtt": ["WebsiteCloudFrontDistribution", "DomainName"],
        },
      },
    };
    fs.writeFileSync(serverlessConfigPath, yaml.dump(serverlessConfig));

    /* The domain must be added and verified durring the same serverless
     * deployment. So we'll let the user decide on their own when they want to do
     * that. */
    fs.writeFileSync(
      `${outDir}/to-use-a-custom-domain-add-these-properties.yml`,
      yaml.dump(customDomainAddInsJson),
    );

    // Install the logging serverless plugin
    await runCmd({
      command: `npm install --save serverless-stack-output`,
      path: outDir,
    });
  },
};

const awsHostingResources = {
  WebsiteHostingBucket: {
    Type: "AWS::S3::Bucket",
    Properties: {
      AccessControl: "PublicRead",
      BucketName: "${self:service}-${self:provider.stage}-whb",
      WebsiteConfiguration: {
        IndexDocument: "index.html",
      },
    },
  },
  WebsiteHostingBucketPolicy: {
    Type: "AWS::S3::BucketPolicy",
    Properties: {
      Bucket: { Ref: "WebsiteHostingBucket" },
      PolicyDocument: {
        Statement: [
          {
            Action: ["s3:GetObject"],
            Effect: "Allow",
            Resource: { "Fn::Sub": "arn:aws:s3:::${WebsiteHostingBucket}/*" },
            Principal: {
              CanonicalUser: {
                "Fn::GetAtt":
                  "WebsiteCloudFrontOriginAccessIdentity.S3CanonicalUserId",
              },
            },
          },
        ],
      },
    },
  },
  WebsiteCloudFrontOriginAccessIdentity: {
    Type: "AWS::CloudFront::CloudFrontOriginAccessIdentity",
    Properties: {
      CloudFrontOriginAccessIdentityConfig: {
        Comment: "Temmp comment. ",
      },
    },
  },
  WebsiteCloudFrontDistribution: {
    Type: "AWS::CloudFront::Distribution",
    Properties: {
      DistributionConfig: {
        CustomErrorResponses: [
          {
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          },
          {
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          },
        ],
        DefaultCacheBehavior: {
          AllowedMethods: ["GET", "HEAD", "OPTIONS"],
          CachedMethods: ["GET", "HEAD", "OPTIONS"],
          Compress: true,
          DefaultTTL: 3600,
          ForwardedValues: {
            Cookies: {
              Forward: "none",
            },
            QueryString: false,
          },
          MaxTTL: 86400,
          MinTTL: 60,
          TargetOriginId: "s3origin",
          ViewerProtocolPolicy: "redirect-to-https",
        },
        DefaultRootObject: "index.html",
        Enabled: true,
        HttpVersion: "http2",
        Origins: [
          {
            DomainName: { "Fn::GetAtt": "WebsiteHostingBucket.DomainName" },
            Id: "s3origin",
            S3OriginConfig: {
              OriginAccessIdentity: {
                "Fn::Sub":
                  "origin-access-identity/cloudfront/${WebsiteCloudFrontOriginAccessIdentity}",
              },
            },
          },
        ],
        PriceClass: "PriceClass_All",
      },
    },
  },
};

const customDomainAddInsJson = {
  provider: {
    custom: {
      WEBSITE_DOMAIN_NAME: "example.com",
    },
  },
  resources: {
    Resources: {
      WebsiteCloudFrontDistribution: {
        Properties: {
          DistributionConfig: {
            Aliases: ["www.${self:provider.custom.WEBSITE_DOMAIN_NAME}"],
            ViewerCertificate: {
              AcmCertificateArn: {
                Ref: "WebsiteDomainCertificate",
              },
              SslSupportMethod: "sni-only",
            },
          },
        },
      },
      WebsiteDomainCertificate: {
        Type: "AWS::CertificateManager::Certificate",
        Properties: {
          DomainName: "*.${self:provider.custom.WEBSITE_DOMAIN_NAME}",
          ValidationMethod: "DNS",
        },
      },
    },
  },
};
