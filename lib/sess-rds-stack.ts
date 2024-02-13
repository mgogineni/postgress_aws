import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class SessRdsStackpg extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const engine = DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_15_5 });
    const instanceType = InstanceType.of(InstanceClass.M6I, InstanceSize.XLARGE);
    const port = 5432;
    const multiAz = true;
    const dbName = "sesspg";

    // create database master user secret and store it in Secrets Manager
    const masterUserSecret = new Secret(this, "db-admin-user-secret-postgres", {
      secretName: "db-admin-user-secret-postgres",
      description: "Database master user credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        passwordLength: 16,
        excludePunctuation: true,
      },
    });

    // We know this VPC already exists
    const myVpc = Vpc.fromLookup(this, "my-vpc", { vpcId: "vpc-074b34d3b2100ab51" });

    // Create a Security Group
    const dbSg = new SecurityGroup(this, "sesspg-SG", {
      securityGroupName: "sesspg-SG",
      vpc: myVpc,
    });

    // Add Inbound rule
    // dbSg.addIngressRule(
    //   Peer.ipv4(myVpc.vpcCidrBlock),
    //   Port.tcp(port),
    //   `Allow port ${port} for database connection from only within the VPC (${myVpc.vpcId})`
    // );

    // create RDS instance (PostgreSQL)
    const dbInstance = new DatabaseInstance(this, "SESS-Postgres", {
      vpc: myVpc,
      // vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      vpcSubnets: { subnetType: SubnetType.PUBLIC},
      instanceType,
      engine,
      multiAz,
      port,
    //   securityGroups: [dbSg],
      databaseName: dbName,
      credentials: Credentials.fromSecret(masterUserSecret),
      backupRetention: Duration.days(0), // disable automatic DB snapshot retention
      deleteAutomatedBackups: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });



    // DB connection settings will be appended to this secret (host, port, etc.)
    // masterUserSecret.attach(dbInstance);
  }
}