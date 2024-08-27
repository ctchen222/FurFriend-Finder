-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(50) NOT NULL,
    "name" VARCHAR(20),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
