import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";

const loginSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(1, "请输入密码"),
});

const registerSchema = z.object({
  name: z.string().min(1, "请输入姓名").max(50, "姓名不超过50个字符"),
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(8, "密码至少8位"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "两次密码不一致",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
};

export function AuthDialog({ open, onOpenChange, defaultTab = "login" }: Props) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.email.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      onOpenChange(false);
      navigate("/feed");
    },
  });

  const registerMutation = trpc.auth.email.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      onOpenChange(false);
      navigate("/feed");
    },
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterForm) => {
    registerMutation.mutate({
      email: data.email,
      password: data.password,
      name: data.name,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">欢迎使用吃了吗</DialogTitle>
        </DialogHeader>

        <p className="text-center text-sm text-muted-foreground -mt-2">
          仅限 @student.xjtlu.edu.cn 和 @xjtlu.edu.cn 邮箱
        </p>

        <Tabs defaultValue={defaultTab} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
          </TabsList>

          {/* 登录 */}
          <TabsContent value="login">
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label htmlFor="login-email">邮箱</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="xxx@student.xjtlu.edu.cn"
                  {...loginForm.register("email")}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="login-password">密码</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="输入密码"
                  {...loginForm.register("password")}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              {loginMutation.error && (
                <p className="text-sm text-destructive text-center">{loginMutation.error.message}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "登录中..." : "登录"}
              </Button>
            </form>
          </TabsContent>

          {/* 注册 */}
          <TabsContent value="register">
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label htmlFor="reg-name">姓名</Label>
                <Input
                  id="reg-name"
                  placeholder="你的名字"
                  {...registerForm.register("name")}
                />
                {registerForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-email">邮箱</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="xxx@student.xjtlu.edu.cn"
                  {...registerForm.register("email")}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-password">密码（至少8位）</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="设置密码"
                  {...registerForm.register("password")}
                />
                {registerForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-confirm">确认密码</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="再次输入密码"
                  {...registerForm.register("confirmPassword")}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              {registerMutation.error && (
                <p className="text-sm text-destructive text-center">{registerMutation.error.message}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "注册中..." : "注册"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
