using System;
using WebPush;

class Program
{
    static void Main()
    {
        var vapidKeys = VapidHelper.GenerateVapidKeys();
        Console.WriteLine($"PublicKey: {vapidKeys.PublicKey}");
        Console.WriteLine($"PrivateKey: {vapidKeys.PrivateKey}");
    }
}
